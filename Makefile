# directories
SRC    := src
STATIC := static
OUT    := $(STATIC)/wasm
WASM   := $(OUT)/simulatorWasm.js

# files
SOURCES := $(shell find $(SRC) -name "*.c")

# tools
CC     := emcc
CFLAGS := -sMODULARIZE=1 -sEXPORT_ES6=1 \
          -sEXPORTED_RUNTIME_METHODS='["lengthBytesUTF8","stringToUTF8","UTF8ToString"]' \
          -sEXPORTED_FUNCTIONS='["_malloc","_free"]'
SERVER := python -m http.server

.PHONY: all serve wasm clean

all: $(WASM)

$(WASM): $(SOURCES)
	mkdir -p $(OUT)
	$(CC) $(CFLAGS) $(SOURCES) -o $(WASM)

serve: $(WASM)
	cd static && $(SERVER)

clean:
	rm -rf $(OUT)

