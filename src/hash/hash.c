#include "hash.h"

uint64_t hashBytes(uint64_t hash, const void *data, size_t size) {
	const uint8_t *bytes = data;

	for (size_t i = 0; i < size; i++) {
		hash ^= bytes[i];
		hash *= FNV_PRIME;
	}

	return hash;
}

// gets index from hash
size_t hashIndex(uint64_t hash) {
	return hash % HASH_SET_CAPACITY;
}

void hashSetInit(HashSet* set) {
	for (size_t i = 0; i < HASH_SET_CAPACITY; i++)
		set->hashes[i] = HASH_EMPTY;
}

int hashSetInsert(HashSet* set, uint64_t hash) {
	size_t idx = hashIndex(hash);
	size_t count = 0;

	while (set->hashes[idx] != HASH_EMPTY && count != HASH_SET_CAPACITY) {
		if (set->hashes[idx] == hash)
			return 1;

		idx = (idx + 1) % HASH_SET_CAPACITY;
		count++;
	}

	set->hashes[idx] = hash;
	return 0;
}
