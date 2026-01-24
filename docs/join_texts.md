# Join Texts

![node](./images/join_texts.png)

## Features

- Combines multiple text inputs into a single text.
- Input sockets are dynamically added. New inputs are automatically created when connected.
- Automatically handles duplicate separators.
- Unconnected inputs are treated as empty and ignored.


## Input Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| text_1 | STRING | First text input (optional, socket input) |
| separator | STRING | Separator for text joining (default: `,`) |
| text_2, text_3, ... | STRING | Additional text inputs (dynamically added on connection) |


## Outputs

| Output | Type | Description |
|--------|------|-------------|
| text | STRING | Text joined with separator |


## Dynamic Inputs

- When connecting to `text_1`, a `text_2` input socket is automatically added.
- As you continue connecting, inputs increase: `text_3`, `text_4`, ...


## Separator Handling

Prevents duplication when input text already contains separators at the beginning or end:

- Input 1: `tag1, tag2,`
- Input 2: `, tag3, tag4`
- Output: `tag1, tag2, tag3, tag4`


## Usage Example

Used when combining tags or prompts output from multiple nodes into one. Useful for joining the tags output from Load LoRAs With Tags with other prompt nodes.
