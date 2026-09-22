#!/usr/bin/env python3
"""
一次性脚本：把 a-maliarov/amazoncaptcha 原始的 training_data
（每个字母一个 json，内容是 str(zlib.compress(bit_string)) 生成的
Python bytes repr 字符串列表）转换成一个扁平的 fingerprints.json：

    { "<01像素指纹>": "<字母>", ... }

这样 Node/TypeScript 那边就不用在 JS 里处理 zlib 解压和 Python
bytes repr（形如 b'x\\x9c\\x0b...'）的解析，直接拿指纹字符串去
查表即可。

用法：
    python convert_training_data.py <原始training_data目录> <输出fingerprints.json路径>

示例：
    python convert_training_data.py ./training_data_python ./fingerprints.json
"""

import ast
import json
import os
import sys
import zlib


def convert(src_dir: str, out_path: str) -> None:
    flat_map: dict = {}
    skipped = 0

    for filename in os.listdir(src_dir):
        if not filename.endswith('.json'):
            continue

        letter = filename.split('.')[0]

        with open(os.path.join(src_dir, filename), 'r', encoding='utf-8') as f:
            variants = json.loads(f.read())

        for repr_string in variants:
            try:
                raw_bytes = ast.literal_eval(repr_string)  # "b'x\\x9c...'" -> bytes
                bit_string = zlib.decompress(raw_bytes).decode('utf-8')
            except Exception:
                # 个别历史脏数据解析失败时跳过，不影响整体转换
                skipped += 1
                continue

            flat_map[bit_string] = letter

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(flat_map, f)

    print(f'{len(flat_map)} fingerprints written to {out_path}')
    if skipped:
        print(f'({skipped} entries skipped due to parse errors)')


if __name__ == '__main__':
    src_dir = sys.argv[1] if len(sys.argv) > 1 else 'training_data'
    out_path = sys.argv[2] if len(sys.argv) > 2 else 'fingerprints.json'
    convert(src_dir, out_path)