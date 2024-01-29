#include <iostream>
#include <cstdio>
#include <stdint.h>
#include <sys/mman.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <netinet/udp.h>
#include <arpa/inet.h>
#include <cstring>

const uint32_t COV_BITMAP_SIZE = 16777216;  // 2 ** 24
const uint32_t COV_SERVER_PORT = 7155;


struct CovBitmap {
    uint8_t buf[COV_BITMAP_SIZE];
};

CovBitmap* covBitmap{nullptr};

int covSenderFd{-1};
struct sockaddr_in covServer;

void initShm()
{
    if (covBitmap != nullptr)
    {
        return;
    }

    int fd = shm_open("FUZZ_COV_BITMAP", O_RDWR | O_CREAT, 0666);
    if (fd == -1)
    {
        perror("Failed to shm_open:");
        exit(41);
    }

    if (ftruncate(fd, sizeof(CovBitmap)) == -1)
    {
        perror("Failed to ftruncate:");
        exit(42);
    }

    covBitmap = (CovBitmap*)mmap(NULL, sizeof(CovBitmap), PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
    if(covBitmap == MAP_FAILED)
    {
        perror("Failed to mmap:");
        exit(43);
    }
}

void initSock()
{
    if (covSenderFd != -1)
    {
        return;
    }

    covSenderFd = socket(AF_INET, SOCK_DGRAM, 0);
    if (covSenderFd < 0)
    {
        perror("Failed to create socket:");
        exit(44);
    }

    covServer.sin_family = AF_INET;
    covServer.sin_port = htons(COV_SERVER_PORT);
    covServer.sin_addr.s_addr = inet_addr("127.0.0.1");
}

void covSend(void* pc)
{
    uint64_t pc_int = reinterpret_cast<uint64_t>(pc);
    if (sendto(covSenderFd, &pc_int, sizeof(uint64_t), 0, (struct sockaddr *)&covServer, sizeof(covServer)) < 0)
    {
        perror("Failed to sendto:");
        exit(45);
    }
    printf("sent msg\n");
}

inline bool covContains(void* pc)
{
    return covBitmap->buf[reinterpret_cast<uint64_t>(pc) % COV_BITMAP_SIZE] != 0;
}

inline void covSet(void* pc)
{
    covBitmap->buf[reinterpret_cast<uint64_t>(pc) % COV_BITMAP_SIZE] = 1;
}

extern "C"
void __sanitizer_cov_trace_pc(void)
{
    void* pc = __builtin_return_address(0);

    initShm();
    initSock();

    if (!covContains(pc))
    {
        covSet(pc);

        covSend(pc);

        printf("First hit of %p\n", pc);
    }

    // check for non-covered yet is like with check for unique stacktrace.
    // like at work, in init open shmem, check if hash contains (also index based on bit? dont care about double send)
    // if not contains: write and send to worker queue somehow (domain socket?)
}

