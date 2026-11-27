# Decade Counter

### Overview

This circuit implements a series of three trigger-chained decade counters.
Each counter counts from 0 to 9, then sends a `TRIG` pulse to the next one in
the chain.
By organizing these counters left to right, we obtain units, tens and hundreds,
allowing us to count up to 999.

### How to use

- The clock starts automatically when the simulation begins.
- Turn the `ENB` input high to start counting!

### Interesting bits

- The BCD digits are visualized on eight-segment displays.
  The eighth segment is the decimal point, unused here and shorted to ground.
- The `DECODE BCD` IC converts BCD digits into display control signals.
  Its implementation might look complex, but it is simply an implementation of
  reduced Boolean algebra formulas.

### Inside the circuit

If you look inside the `COUNTER` IC, you'll find the actual building blocks of
the circuit: the `DEC CNT` ICs implement the individual decade counters.

These are naively implemented using 4-bit registers connected to adders. A mask
detects the digit 9, raises a `TRIG` output and resets the counter.

### Things to try

- Simplify the adder using half adders.
- Try implementing the counters asynchronously.
- Investigate why some asynchronous implementations are unstable.
