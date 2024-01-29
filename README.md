###

- libafl func is in rust. likely need to write this in rust. -> no. just write it in sancov_cmp.c and get lookup right

- SUT needs way to map from pc -> index, where it can then set index.

- maybe use \_\_sanitizer_symbolize_pc for fast PC -> src code lookup? if its fast

### frontend

- page with overview and % cov lines of all files, like lcov
- for 'cov in all files', check all files linked in elf and display these - use GDB for fast lookup
  - percentage will be difficult, since we don't know how many lines are actually covered and executable
    -> might not be needed anymore, since we include them with objdump - not all, but the ones we care about

### mid

- split in different files
- argparse
