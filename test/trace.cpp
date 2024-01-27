#include <iostream>
#include <cstdio>
#include <stdint.h>

extern "C"
void __sanitizer_symbolize_pc(void* pc, const char* fmt, char* out_buf, size_t out_buf_size);

uint32_t hash_string(const char* s)
{
    uint32_t hash = 0;
    for (; *s; ++s)
    {
        hash += *s;
        hash += (hash << 10);
        hash ^= (hash >> 6);
    }

    hash += (hash << 3);
    hash ^= (hash >> 11);
    hash += (hash << 15);

    return hash;
}

extern "C"
void __sanitizer_cov_trace_pc(void)
{
    void* pc = __builtin_return_address(0);

    char pcDescr[1024];
    __sanitizer_symbolize_pc(pc, "%s\t%l", pcDescr, sizeof(pcDescr));
    printf("cov: %s\n", pcDescr);

    printf("Hash: %d\n", hash_string(pcDescr));

    // check for non-covered yet is like with check for unique stacktrace.
    // like at work, in init open shmem, check if hash contains (also index based on bit? dont care about double send)
    // if not contains: write and send to worker queue somehow (domain socket?)
}

