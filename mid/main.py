from __future__ import annotations

import socket
import multiprocessing as mp
import queue
from collections import defaultdict
import time
from flask import Flask
from flask_cors import CORS
import threading
from typing import NoReturn
import json
import subprocess
import sys
import struct
from flask import request


BUFFER_SIZE = 1024
SERVER_PORT = 7155

LINE_COVERAGE_UNKNOWN = 0
LINE_COVERED = 1
LINE_NOT_COVERED = 2

class File:
    def __init__(self) -> None:
        self.lines: list[int] = [LINE_COVERAGE_UNKNOWN]

    def set_covered_line(self, covered_line: int) -> None:
        if covered_line >= len(self.lines):
            self.lines.extend([LINE_COVERAGE_UNKNOWN] * (covered_line + 1 - len(self.lines)))

        self.lines[covered_line] = LINE_COVERED
    
    def set_uncovered_line(self, uncovered_line: int) -> None:
        if uncovered_line >= len(self.lines):
            self.lines.extend([LINE_COVERAGE_UNKNOWN] * (uncovered_line + 1 - len(self.lines)))

        self.lines[uncovered_line] = LINE_NOT_COVERED
    
    def get_covered_lines_count(self) -> int:
        return self.lines.count(LINE_COVERED)

    def get_uncovered_lines_count(self) -> int:
        return self.lines.count(LINE_NOT_COVERED)


class Addr2Line:
    def __init__(self, prog_path: str) -> None:
        self.addr2line_proc = subprocess.Popen(
            ['addr2line', '-i', '-e', prog_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True
        )

    def get_src_code(self, addr: int) -> tuple[str, int]:
        assert self.addr2line_proc.poll() is None, 'addr2line_proc exited'
        self.addr2line_proc.stdin.write(f'{addr:x}\n')
        self.addr2line_proc.stdin.flush()

        src_code_location = self.addr2line_proc.stdout.readline()
        file, line_str = src_code_location.split(' ')[0].split(':')
        line = int(line_str)
        return file, line


class Program:
    def __init__(self, prog_path: str) -> None:
        self.prog_path = prog_path
        self.files: dict[str, File] = defaultdict(File)
        self.a2l = Addr2Line(self.prog_path)

        self.set_uncovered_addresses()

    def set_uncovered_addresses(self) -> None:
        instrumented_addresses: list[int] = self.get_cov_trace_pc_return_addresses()

        for addr in instrumented_addresses:
            file, line = self.a2l.get_src_code(addr)
            if file == '??':
                print(f'Unknown source code location at {addr=}')
                continue
            self.files[file].set_uncovered_line(line)

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

    def on_new_addr_covered(self, addr: int) -> None:
        file, line = self.a2l.get_src_code(addr)
        if file == '??':
            print(f'Unknown source code location at {addr=}')
            return

        self.files[file].set_covered_line(line)

    def get_coverage_overview(self) -> tuple[str, int, int]:
        # Returns tuple of [filename, covered_lines, uncovered_lines]
        ret = []
        for filename, file in self.files.items():
            covered_count = file.get_covered_lines_count()
            uncovered_count = file.get_uncovered_lines_count()
            if covered_count + uncovered_count == 0:
                continue
            ret.append((filename, covered_count, uncovered_count))
        ret.sort(key=lambda x: x[1] + x[2], reverse=True)
        return ret


# TODO: use argparse later
if len(sys.argv) < 2:
    raise Exception('Missing argument to target executable. ./main.py path/to/target')

prog = Program(sys.argv[1])

def main() -> NoReturn:

    new_cov_queue: mp.Queue[int] = mp.Queue()

    cov_receiver_proc = mp.Process(target=new_cov_receiver, args=(new_cov_queue,))
    cov_receiver_proc.start()

    threading.Thread(target=lambda: app.run(host='0.0.0.0', port=API_PORT, debug=True, use_reloader=False)).start()

    last_cov_receive_time = time.time()

    while True:
        try:
            pc = new_cov_queue.get(block=False)
            prog.on_new_addr_covered(pc)
        except queue.Empty:
            pass

        if last_cov_receive_time + 0.3 < time.time():
            time.sleep(0.1)

def new_cov_receiver(new_cov_queue: mp.Queue[tuple[int, str, int]]) -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('127.0.0.1', SERVER_PORT))

    print('UDP Server started on port', SERVER_PORT)

    while True:
        message, _ = sock.recvfrom(BUFFER_SIZE)

        pc = struct.unpack('Q', message)[0]
        print('Covered', pc)

        new_cov_queue.put(pc)


API_PORT = 7156

app = Flask(__name__)
CORS(app)


@app.route('/coveredLines')
def getCoveredLines():
    path = request.args.get('path')
    ret = json.dumps(prog.files[path].lines)
    return ret


# TODO: maybe send 2 sets: the one in rootPath and the rest
@app.route('/coverageOverview')
def getCoverageOverview():
    rootPath = request.args.get('path')

    selected_files = []
    unselected_files = []

    for file_data in prog.get_coverage_overview():
        # when prefix doesnt match due to build in different env, maybe check what opened folder path is and exclude that
        if rootPath in file_data[0]:
            selected_files.append(file_data)
        else:
            unselected_files.append(file_data)

    return json.dumps({
        'selected': selected_files,
        'unselected': unselected_files
    })

if __name__ == '__main__':
    raise SystemExit(main())