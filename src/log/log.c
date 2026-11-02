#include "log.h"

#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>

static char event_buf[LOG_EVENTS][EVENT_SIZE];
static size_t event_num = 0;

void logEvent(const char *fmt, ...) {
	if (event_num == LOG_EVENTS)
		return;
	char *target = event_buf[event_num++];

	// format message
	va_list ap;
	va_start(ap, fmt);
	vsnprintf(target, EVENT_SIZE, fmt, ap);
	va_end(ap);
}

void logPrint() {
	printf("Simulation logged %zu events:\n", event_num);

	for (size_t i = 0; i < event_num; i++) {
		printf("%s\n", event_buf[i]);
	}

	event_num = 0;
}
