# UART

### Overview

This circuit implements a simple UART serial transmitter and receiver, 
using separate transmitter and receiver datapaths coordinated by a shared
control unit.

UART compatibility is actually quite comprehensive:
- START / STOP bit support;
- Line fixed high while not transmitting;
- 4 bits transmitted (of which you can make any one the parity and STOP bit).

Clock detection is not implemented, though!
Both the transmitter and receiver datapath expect signals from the same control
unit.

The transmitter converts a 4-bit parallel word into a serial bitstream, while
the receiver performs the opposite operation, reconstructing a 4-bit word from
incoming serial data.

### How to use

- The `TX DP` and `RX DP` ICs implement the transmitter and receiver datapaths,
  respectively.
- The `CONTROL` IC generates the control signals needed to coordinate both
  datapaths.
- The clock is fed automatically. Load the word you want to transmit in the
  TXD register, then press start. You don't have to put start back to low, the
  circuit already detects edges. Wait for the transaction to complete (9
  cycles), and you'll see the word you inputted in the RXD register!

### Interesting bits

- The transmitter is built around a `PISO 4` IC (Parallel-In Serial-Out), a 
  shift register implemented using multiplexers. It supports asynchronous
  parallel loading, simplifying the control logic considerably. Beware of
  spurious inputs when using asynchronous loads, though!
- The receiver uses a `SIPO 4` IC (Serial-In Parallel-Out). Its implementation
  is simpler: only the shift register is needed, and its parallel outputs can
  be sampled directly.
- Both datapaths use buffering registers, allowing data to be loaded and
  retrieved independently of the serial shifting operations.

### Inside the circuit

The `CONTROL` IC is responsible for coordinating the entire transmission and
reception process.

It takes a clock and a start level as inputs.
An `EDGE` IC extracts an edge trigger from the start signal, which is then used
to initiate the control sequence.

A 4-bit `COUNTER` IC iterates through the control states. Each state determines
the outputs of the control unit:

| State | TXCL | TXLD | RXCL | RXLD |
|---:|:---:|:---:|:---:|:---:|
| 0 | 0 | 0 | 0 | 0 |
| 1 | 0 | 1 | 0 | 0 |
| 2 | 0 | 0 | 1 | 0 |
| 3 | 1 | 0 | 0 | 0 |
| 4 | 0 | 0 | 1 | 0 |
| 5 | 1 | 0 | 0 | 0 |
| 6 | 0 | 0 | 1 | 0 |
| 7 | 1 | 0 | 0 | 0 |
| 8 | 0 | 0 | 1 | 0 |
| 9 | 1 | 0 | 0 | 1 |

The control signals have the following purposes:

- `TXCL`: advances the transmitter to the next bit.
- `TXLD`: loads a new 4-bit word into the transmitter.
- `RXCL`: samples the next incoming bit into the receiver.
- `RXLD`: transfers the received word into the receiver's output register.

Since `TXLD` and `RXLD` are asynchronous operations, the corresponding control
outputs are synchronized using D flip-flops to avoid timing issues (the same
spurious inputs from before).

### Things to try

- Experiment with alternative control-state sequences.
- Try simplifying the control logic or implementing it using a different
  state-machine architecture.
- Investigate the effects of asynchronous loads and spurious input transitions
  on the transmitter.
- Consider extending the datapaths to support more than 4 bits.
- Try to split the control units and implement clock detection on the receiver!
