#ifndef HASH_H
#define HASH_H

#include <stddef.h>
#include <stdint.h>

// hashing constants
#define FNV_OFFSET 14695981039346656037ULL
#define FNV_PRIME  1099511628211ULL

// hashes binary data 
uint64_t hashBytes(uint64_t hash, const void *data, size_t size);

// capacity of hash set
#define HASH_SET_CAPACITY 1024

// empty hash
#define HASH_EMPTY 0ULL

// hash set declaration
typedef struct {
	uint64_t hashes[HASH_SET_CAPACITY];
} HashSet;

// initializes hash set 
void hashSetInit(HashSet *set);

// inserts into hash set, return 1 on hit, 0 on miss (and fill) 
int hashSetInsert(HashSet *set, uint64_t hash);

#endif
