from __future__ import annotations

import socket
import multiprocessing as mp
import queue
from dataclasses import dataclass
from collections import defaultdict
import time
from flask import Flask
from flask_cors import CORS
import threading
from typing import NoReturn
import json
import subprocess
import sys


BUFFER_SIZE = 1024
SERVER_PORT = 7155

@dataclass
class SrcLine:
    addr: int
    line: int

class File:
    def __init__(self) -> None:
        # Line index [0] does not exist and is thus never covered.
        self.lines: list[bool] = [False]
    
    def set_covered_line(self, covered_line: int):
        if covered_line >= len(self.lines):
            self.lines.extend([False] * (covered_line + 1 - len(self.lines)))

        self.lines[covered_line] = True


class Addr2Line:
    def __init__(self, prog_path: str) -> None:
        self.addr2line_proc = subprocess.Popen(
            ['addr2line', '-i', '-e', prog_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True
        )
    
    def get_src_code(self, addr: int) -> str:
        assert self.addr2line_proc.poll() is None, 'addr2line_proc exited'
        self.addr2line_proc.stdin.write(f'{addr:x}\n')
        self.addr2line_proc.stdin.flush()
        return self.addr2line_proc.stdout.readline()


class Program:
    def __init__(self, prog_path: str) -> None:
        self.prog_path = prog_path
        self.files: dict[str, File] = defaultdict(File)
        self.cov_trace_pc_return_addresses = self.get_cov_trace_pc_return_addresses()
        # TODO: convert addr to line using addr2line subproc

    def get_cov_trace_pc_return_addresses(self) -> list[int]:
        cov_trace_pc_return_addresses: list[int] = []
        objdump_output = subprocess.check_output(['objdump', '-d', self.prog_path], encoding='utf-8')
        assembly_lines = objdump_output.split('\n')

        for i, line in enumerate(assembly_lines):
            if not line.endswith('<__sanitizer_cov_trace_pc>'):
                continue
            ret_line = assembly_lines[i+1]
            return_address = int(ret_line.strip().split('\t')[0][:-1], 16)
            cov_trace_pc_return_addresses.append(return_address)
    
        return cov_trace_pc_return_addresses



# TODO: use argparse later
if len(sys.argv) < 2:
    raise Exception('Missing argument to target executable. ./main.py path/to/target')

prog = Program(sys.argv[1])
print(prog.cov_trace_pc_return_addresses)


def main() -> NoReturn:

    new_cov_queue: mp.Queue[tuple[int, str, int]] = mp.Queue()

    cov_receiver_proc = mp.Process(target=new_cov_receiver, args=(new_cov_queue,))
    cov_receiver_proc.start()

    threading.Thread(target=lambda: app.run(host='0.0.0.0', port=API_PORT, debug=True, use_reloader=False)).start()

    last_cov_receive_time = time.time()

    while True:
        try:
            _, file, line = new_cov_queue.get(block=False)
            prog.files[file].set_covered_line(line)
        except queue.Empty:
            pass

        if last_cov_receive_time + 0.3 < time.time():
            time.sleep(0.1)

            # prog.files['a.cpp'].set_covered_lines([random.randrange(200)])


def new_cov_receiver(new_cov_queue: mp.Queue[tuple[int, str, int]]) -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('127.0.0.1', SERVER_PORT))

    print('UDP Server started on port', SERVER_PORT)

    while True:
        message, _ = sock.recvfrom(BUFFER_SIZE)

        pc, file, line = message.decode().split('\t')
        # ASAN decrements 1 from pc
        pc += 1
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


API_PORT = 7156

app = Flask(__name__)
CORS(app)


@app.route('/coveredLines')
def getCoveredLines():
    # TODO: file based on param
    ret = json.dumps(prog.files['/home/user/P/FuzzSight/test/main.cpp'].lines)
    print(ret)
    return ret


if __name__ == '__main__':
    raise SystemExit(main())