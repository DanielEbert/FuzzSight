###

- libafl func is in rust. likely need to write this in rust. -> no. just write it in sancov_cmp.c and get lookup right

- SUT needs way to map from pc -> index, where it can then set index.

- maybe use \_\_sanitizer_symbolize_pc for fast PC -> src code lookup? if its fast

### frontend

- page with overview and % cov lines of all files, like lcov
- for 'cov in all files', check all files linked in elf and display these - use GDB for fast lookup
  - percentage will be difficult, since we don't know how many lines are actually covered and executable

### find uncovered

- check objdump where we have calls to \_\_sanitizer_cov_trace_pc
- remember return addr is 1 after call to cov_trace_pc

  - when parsing objdump output, remember the instr after call to cov_trace_pc

- instead of sending true false to ui, send color code: 0 white - 1 green - 2 red
