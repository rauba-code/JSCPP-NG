import argparse
import re

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('infile')
    parser.add_argument('outfile')
    args = parser.parse_args()
    f = open(args.infile, 'r');
    lines = f.readlines();
    f.close();
    d : dict[str, set[str]] = dict();
    M_NORMAL = "normal";
    M_MULTILINE_LHS = "multiline_lhs";
    M_MULTILINE_RHS = "multiline_rhs";
    m_brace = 0;
    mode = M_NORMAL;
    m_parent : str = '';
    for line in lines:
        print('> ' + line, end='')
        if (mode == M_NORMAL or mode == M_MULTILINE_LHS or mode == M_MULTILINE_RHS) and m_brace == 0:
            parent : str = '';
            ln = line
            if mode == M_NORMAL:
                m = re.search('^[ \t]*([a-zA-Z][a-zA-Z_0-9]*)[ \t]*("[^"]*")?[ \t]*=[ \t]*', line)
                if m == None:
                    m = re.search('^[ \t]*([a-zA-Z][a-zA-Z_0-9]*)[ \t]*("[^"]*")?[ \t]*$', line)
                    if m == None:
                        if line.startswith('{'):
                            m_brace = len([c for c in line if c == "{"]) - len([c for c in line if c == "}"])
                        continue
                    mode = M_MULTILINE_LHS
                    m_parent = m.group(1)
                    print(f" >> {mode=}");
                    print(f" >> {m_parent=}");
                    continue
                parent = m.group(1);
                print(f" >> {parent=}");
                ml = len(m.group(0));
                ln = line[ml:]
                d[parent] = set();
            elif mode == M_MULTILINE_LHS:
                parent = m_parent
                m = re.search('^[ \t]*=[ \t]*', ln);
                if m == None:
                    print(f" >> not found the '=' sign");
                    continue
                mode = M_NORMAL
                ml = len(m.group(0));
                ln = line[ml:]
                d[parent] = set();
            else:
                parent = m_parent
            while len(ln) > 0:
                while True:
                    m = re.search('^("[^"]*"|\'[^\']*\'|\\[[^]]*[^[\\]]\\]|//.*|/|[ \t\n]+|[a-zA-Z_0-9]+:|[()*+?!_])+', ln)
                    if m == None:
                        break
                    mg = m.group(0);
                    print(f" >> omitting {mg=}");
                    ln = ln[len(mg):]
                if ln.startswith(";"):
                    mode = M_NORMAL
                    print(" >> reached end of sentence")
                    break
                elif ln.startswith('{'):
                    i = 0
                    for c in ln:
                        if c == '{':
                            m_brace = m_brace + 1;
                        if c == '}':
                            m_brace = m_brace - 1;
                        i = i + 1
                        if m_brace == 0:
                            break;
                    mg = ln[:i]
                    print(f" >> omitting {mg=}");
                    ln = ln[i:]
                    continue
                if len(ln) == 0:
                    break
                m = re.search('^([a-zA-Z][a-zA-Z_0-9]*)[ \t]*', ln)
                if m == None:
                    m = re.search('^{[^}]*$', ln)
                    if m != None:
                        m_brace = len([c for c in m.group(0) if c == "{"]) - len([c for c in m.group(0) if c == "}"])
                        print(f" >> {m_brace=}")
                        break;
                    print(f" >> unknown token {ln=}")
                    break
                else:
                    mg = m.group(0);
                    identifier = m.group(1);
                    print(f" >> {identifier=}");
                    ln = ln[len(mg):]
                    d[parent].add(identifier);
            if len(ln) == 0 and mode == M_NORMAL or mode == M_MULTILINE_RHS:
                mode = M_MULTILINE_RHS;
                print(f" >> reached end of line")
            else:
                print(f' >> {d[parent]=}')
        elif m_brace > 0:
            m_brace = m_brace + len([c for c in line if c == "{"]) - len([c for c in line if c == "}"]);
            print(f" >> {m_brace=}")
    print('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>')
    f = open(args.outfile, "w")
    print('digraph G {\n  overlap=prism;\n  mclimit=4;', file=f)
    for parent, vals in d.items():
        print(f"  {parent} [shape=box,style=filled,fillcolor=gray];", file=f);
        for child in vals:
            #print(f"  {parent} -> {child} [headlabel={parent},labelfontsize=10,labelfloat=true];", file=f);
            if d.get(child) != None:
                print(f"  {parent} -> {child};", file=f);
    print('}', file=f)
    f.close()


    

