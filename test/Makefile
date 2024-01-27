CXX=g++-9
CXXFLAGS=-g -fsanitize-coverage=trace-pc -fsanitize=address,undefined -no-pie

all: main

trace.o: trace.cpp
	$(CXX) -c -o $@ $< -fsanitize=address,undefined

main.o: main.cpp
	$(CXX) -c -o $@ $< $(CXXFLAGS)

main: main.o trace.o
	$(CXX) -o $@ $^ $(CXXFLAGS)

.PHONY: clean
clean:
	rm -f *.o main

