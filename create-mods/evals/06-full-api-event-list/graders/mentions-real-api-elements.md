---
type: regex
target: last_message
match: contains
weight: 1
---
(?=[\s\S]*\$\.store)(?=[\s\S]*\$\.clock)(?=[\s\S]*\$\.mcp)(?=[\s\S]*tool\.call)[\s\S]*
