# directories
SRC    := src
STATIC := static
OUT    := $(STATIC)/wasm
LIB    := $(STATIC)/lib
WASM   := $(OUT)/simulatorWasm.js

# files
SOURCES := $(shell find $(SRC) -name "*.c")

# tools
CC     := emcc
CFLAGS := -sMODULARIZE=1 -sEXPORT_ES6=1 \
          -sEXPORTED_RUNTIME_METHODS='["lengthBytesUTF8","stringToUTF8","UTF8ToString"]' \
          -sEXPORTED_FUNCTIONS='["_malloc","_free"]'
SERVER := python -m http.server
INDEX := python index.py

.PHONY: all serve wasm clean format index

all: $(WASM) index

index:
	cd $(LIB) && $(INDEX)

$(WASM): $(SOURCES)
	mkdir -p $(OUT)
	$(CC) $(CFLAGS) $(SOURCES) -o $(WASM)

serve: $(WASM) index
	cd static && $(SERVER)

clean:
	rm -rf $(OUT)

format:
	find . -type f \( \
		-name '*.js' -o \
		-name '*.html' -o \
		-name '*.css' \
	\) -exec prettier --write {} +
	find . -type f \( \
		-name '*.c' -o \
		-name '*.h' \
	\) -exec clang-format -i {} +
