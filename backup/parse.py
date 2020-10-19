# Spec 01+03+04+05+09+17
# Spec1+2+3+4+5+8+10
# python parse.py > output.sql

import csv


def parse(type1, type2, s):
    nums = s.lower().split('spec')
    nums_str = nums[1].strip()
    tmp = nums_str.split('+')
    res = [int(a) for a in tmp]
    s = []
    for n in res:
        s.append('spec{}'.format(n))
    tt = ["'Y'"]*len(s)

    s.append("type1")
    s.append("type2")

    tt.append("'{}'".format(type1.strip()))
    tt.append("'{}'".format(type2.strip()))

    sa = ",".join(s)
    va = ",".join(tt)
    sql = '''DELETE from wiprocurement.eebom_spa_rules where type1='{}' AND type2='{}';
    INSERT INTO wiprocurement.eebom_spa_rules ({}) VALUES ({}) ;'''.format(
        type1, type2, sa, va, type1, type2)
    return sql


with open('rules.csv') as csvfile:
    # 讀取 CSV 檔案內容
    rows = csv.reader(csvfile)
    # 以迴圈輸出每一列
    for row in rows:
        print(parse(row[0], row[1], row[2]))

