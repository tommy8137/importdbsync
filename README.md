this project is for db sync
1.cbg
2.plm
3.hr
4.fi
5.xray drop down list
6.eedm

## eEDM

### API Job

#### syncEEBOMPipe
執行整個eEDM流程, endDate為SPA_PRICE需要

http://{{HOST}}:3009/eedm/syncEEBOMPipe?startDate=2019-04-25&endDate=2019-04-25

#### syncEEBOMBase
產生 eebom project / version / detail的資料, 只會針對未處理過(wiprocurement.eedm_cost_summarytable.update_time=null)的資料執行

*寫入資料表*: eebom_projects, edm_version, eebom_detail

http://{{HOST}}:3009/eedm/syncEEBOMBase

#### syncEEDM_COST_SUMMARYTABLE
抓取新的eEDM的資料 (Cost_Summarytable 和 BOM Item), 只會針對沒抓過的資料(>max(wiprocurement.eedm_cost_summarytable.uploadtime))

*寫入資料表*: eedm_cost_summarytable, eedm_bom_item

http://{{HOST}}:3009/eedm/syncEEDM_COST_SUMMARYTABLE

#### syncEEDM_PN_LIST
重新抓取eEDM的 Part List, 會刪除目前資料並重新寫入, 所有cost_summarytable 所用到的partnumber 都會在這張表 裡面

*寫入資料表*: eedm_pn_request

http://{{HOST}}:3009/eedm/syncEEDM_PN_LIST

#### syncEEDM_PN_PRICE
從 eedm_pn_request 拿到所有的partnumber, 計算Part List的Part Current Price(最高價, 最低價以及 MLCC第二高價)

*寫入資料表*: eedm_pn_price, eedm_pn_lowest_price, eedm_pn_2nd_high_price

http://{{HOST}}:3009/eedm/syncEEDM_PN_PRICE

#### syncEEDM_PN_HIGHEST_PRICE
從 eedm_pn_request 拿到所有的partnumber, 計算Part List的Part Current Price(最高價)

*寫入資料表*: eedm_pn_price

http://{{HOST}}:3009/eedm/syncEEDM_PN_HIGHEST_PRICE

#### syncEEDM_PN_LOWEST_PRICE
從 eedm_pn_request 拿到所有的partnumber, 計算Part List的Part Current Price(最低價)

*寫入資料表*: eedm_pn_lowest_price

http://{{HOST}}:3009/eedm/syncEEDM_PN_LOWEST_PRICE

#### syncEEDM_PN_2ND_PRICE
從 eedm_pn_request 拿到所有的partnumber, 計算Part List的Part Current Price(MLCC 第二高價)

*寫入資料表*: eedm_pn_2nd_high_price

http://{{HOST}}:3009/eedm/syncEEDM_PN_2ND_HIGH_PRICE

#### syncEEDM_SPA_PRICE
重新計算Part List的Part SPA Price, endDate影響SPA參考匯率

*寫入資料表*: eedm_spa_price

http://{{HOST}}:3009/eedm/syncEEDM_SPA_PRICE?startDate=2019-04-25&endDate=2019-04-25


### Schedule Job
每日執行兩次sync
***1:10***
依序執行syncEEDM_COST_SUMMARYTABLE -> syncEEDM_PN_LIST -> syncEEDM_Common_Patrs -> syncEEDM_PN_PRICE -> syncEEDM_SPA_PRICE -> syncSAP_ALT_PN ->syncEEBomBase -> aggre_BOM_DETAIL_TABLE

***12:10***
依序執行syncEEDM_COST_SUMMARYTABLE -> ->syncEEBomBase -> aggre_BOM_DETAIL_TABLE

