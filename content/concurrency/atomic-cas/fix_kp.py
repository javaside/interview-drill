import pathlib
for name, kid in [('01M3M59WSFCEKJTYGRCCNXC96Y.md','kp-ac1-5'),
                  ('01M3M59WSFMHAG2JTWE04XH3N0.md','kp-ac2-5'),
                  ('01M3M59WSFTNGZWGA0D1AH4S9G.md','kp-ac3-5')]:
    p = pathlib.Path(name)
    t = p.read_text(encoding='utf-8')
    start = t.find('  - id: ' + kid)
    if start == -1:
        print(name[:10], 'no block'); continue
    end = t.find("locator: 'juc'", start)
    end = t.find('\n', end) + 1
    block = t[start:end]
    t = t[:start].rstrip('\n') + '\n' + t[end:].lstrip('\n')
    fm_end = t.index('\n---\n')
    t = t[:fm_end] + '\n' + block + t[fm_end+1:]
    p.write_text(t, encoding='utf-8')
    print(name[:10], 'moved ok')
