# EProcure sync db-sync data SOP

## Run shell script

### type(資料型態)
1. sync cbg,finance,plm db datas
### IP
example : 192.168.100.209
### start time (資料起始時間)
example : 20181011
### end time (資料結束時間)
example : 20181111
### 示意
```
$ ./syncDB.sh ${type} ${IP} ${start_time} ${end_time}
```
### example
```
$ ./syncDB.sh 1 192.168.100.209 20171002 20181210
```

### sync spending

  - exec script 參數解釋
```
$ ./syncDB.sh ${type} ${IP} ${start_month} ${end_month}
```
  - type(資料型態)
    - 3: sync spending datas (spending base + spending types)
  - IP
    - example: `192.168.100.209`
  - start_time
    - 資料起始月份(第一次loop執行2016-01-01~2016-02-01, 逐月執行)
    - example: `201601`
  - end_time
    - 資料結束月份(最後一次loop會執行2018-12-01~2019-01-01)
    - example: `201812`
  - example
```
$ ./syncDB.sh 3 192.168.100.209 201601 201812
```
#### Output Sample
執行結果應該如下所示, 逐月執行, 先更新Spending Type, 再更新Spending Data, (Spending Data需更新較久, 一個月約兩分鐘)
```
[swpc-user@centos7 ~]$ ./syncDB.sh 3 192.168.100.207 201711 201712
start sync spending: 2017-11-01 ~ 2018-01-01
2017-11-01 ~ 2017-12-01
sync SpendingBase Type success
sync SpendingBase Data success
2017-12-01 ~ 2018-01-01
sync SpendingBase Type success
sync SpendingBase Data success
[done]
```

### sync xray dropdown
```
$ ./syncDB.sh ${type} ${IP}
```
  - type(資料型態)
    - 4: sync xray drop down list
  - IP
    - example: `192.168.100.209`
  - example
```
$ ./syncDB.sh 4 192.168.100.209
```

### sync setting ee
```
$ ./syncDB.sh ${type} ${IP}
```
  - type(資料型態)
    - 5: sync type1 type2 list to ee assignment
  - IP
    - example: `192.168.100.209`
  - example
```
$ ./syncDB.sh 5 192.168.100.209
```
