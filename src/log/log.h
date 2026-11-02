#ifndef LOG_H
#define LOG_H

#include "../export.h"

// number of events to keep logged
#define LOG_EVENTS 1024

// max size of an event
#define EVENT_SIZE 256

// logs an event to the event buffer
void logEvent(const char *fmt, ...);

// prints the event buffer, clears it
EXPORT void logPrint();

#endif
