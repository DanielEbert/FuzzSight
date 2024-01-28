

###

- libafl func is in rust. likely need to write this in rust. -> no. just write it in sancov\_cmp.c and get lookup right 

- SUT needs way to map from pc -> index, where it can then set index.

- maybe use __sanitizer_symbolize_pc for fast PC -> src code lookup? if its fast


### frontend

- page with overview and % cov lines of all files, like lcov
