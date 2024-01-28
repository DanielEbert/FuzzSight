from __future__ import annotations

import socket
import multiprocessing as mp
import queue
from dataclasses import dataclass
from collections import defaultdict
import time

BUFFER_SIZE = 1024
SERVER_PORT = 7155

@dataclass
class SrcLine:
    addr: int
    line: int

class File:
    def __init__(self) -> None:
        # Map from src code line to list of addresses.
        # One source code line can have multiple addresses.
        self.lines: dict[int, list[int]] = defaultdict(list)

class Program:
    def __init__(self) -> None:
        self.files: dict[str, File] = defaultdict(File)


def main() -> int:
    prog = Program()

    new_cov_queue: mp.Queue[tuple[int, str, int]] = mp.Queue()

    cov_receiver_proc = mp.Process(target=new_cov_receiver, args=(new_cov_queue,))
    cov_receiver_proc.start()

    last_cov_receive_time = time.time()

    while True:
        try:
            pc, file, line = new_cov_queue.get(block=False)
            prog.files[file].lines[line].append(pc)
        except queue.Empty:
            pass
            

        if last_cov_receive_time + 0.3 < time.time():
            time.sleep(0.1)

    return 0


def new_cov_receiver(new_cov_queue: mp.Queue[tuple[int, str, int]]) -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('127.0.0.1', SERVER_PORT))

    print('UDP Server started on port', SERVER_PORT)

    while True:
        message, _ = sock.recvfrom(BUFFER_SIZE)

        pc, file, line = message.decode().split('\t')
        print('Received', pc, file, line)

        try:
            pc_int = int(pc, 16)
        except:
            pc_int = -1
            print(f'Warning: Failed to convert {pc} to int.')
        try:
            line_int = int(line)
        except:
            line_int = -1
            print(f'Warning: Failed to convert {line} to int.')
        
        new_cov_queue.put((pc_int, file, line_int))

if __name__ == '__main__':
    raise SystemExit(main())