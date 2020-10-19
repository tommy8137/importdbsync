#!/bin/sh


sync_all(){
    echo 'start syncAll_PMPRJTBL_FOR_DASHBOARD'
    curl --request GET \
    --connect-timeout 1000000000 \
    --url 'http://'$1':3009/plm/syncAll_PMPRJTBL_FOR_DASHBOARD?startTime='$2'&endTime='$3''
    echo 'start syncAll_RFQPROJECT_FOR_DASHBOARD'
    curl --request GET \
    --connect-timeout 1000000000 \
    --url 'http://'$1':3009/plm/syncAll_RFQPROJECT_FOR_DASHBOARD?startTime='$2'&endTime='$3''
    echo 'start syncPdmparts'
    curl --request GET \
    --connect-timeout 1000000000 \
    --url 'http://'$1':3009/plm/syncPdmparts?startTime='$2'&endTime='$3''
    echo 'start syncV_BUSINESSORG_BO'
    curl --request GET \
    --connect-timeout 1000000000 \
    --url 'http://'$1':3009/finance/syncV_BUSINESSORG_BO?startTime='$2'&endTime='$3''
    echo 'start syncEPUR_SOURCEDEF'
    curl --request GET \
    --connect-timeout 1000000000 \
    --url 'http://'$1':3009/cbg/syncEPUR_SOURCEDEF?startTime='$2'&endTime='$3''
    echo 'start syncEPUR_SOURCERPROXY'
    curl --request GET \
    --connect-timeout 1000000000 \
    --url 'http://'$1':3009/cbg/syncEPUR_SOURCERPROXY?startTime='$2'&endTime='$3''
    echo 'start syncEPUR_VGROUP'
    curl --request GET \
    --connect-timeout 1000000000 \
    --url 'http://'$1':3009/cbg/syncEPUR_VGROUP?startTime='$2'&endTime='$3''
    echo 'start syncEPUR_TYPE1'
    curl --request GET \
    --connect-timeout 1000000000 \
    --url 'http://'$1':3009/cbg/syncEPUR_TYPE1?startTime='$2'&endTime='$3''
    echo 'start syncEPUR_TYPE2'
    curl --request GET \
    --connect-timeout 1000000000 \
    --url 'http://'$1':3009/cbg/syncEPUR_TYPE2?startTime='$2'&endTime='$3''
    echo 'start syncEPUR_SPEC_TITLE'
    curl --request GET \
    --connect-timeout 1000000000 \
    --url 'http://'$1':3009/cbg/syncEPUR_SPEC_TITLE?startTime='$2'&endTime='$3''
    echo 'start syncEPUR_ITEMTYPE'
    curl --request GET \
    --connect-timeout 1000000000 \
    --url "http://"$1":3009/cbg/syncEPUR_ITEMTYPE?startTime="$2"&endTime="$3""
    echo 'start syncEPUR_ITEMSPEC'
    curl --request GET \
    --connect-timeout 1000000000 \
    --url "http://"$1":3009/cbg/syncEPUR_ITEMSPEC?startTime="$2"&endTime="$3""
}

sync_xray(){
  echo 'start syncXrayBaseData'
  # for ((j=$2; j<=$3; j++))
  # do
  #   for i in {1..12}
  #   do
  #     if [ $i -lt 10 ]; then
  #       i="0$i"
  #     fi
  #     startD=$(date -d $j$i"01" +%s)
  #     now=$(date +%s)
  #     if [ $startD -lt $now ]; then
  #       endD=$(date -d "$(date -d "$j$i"01"+1 month" +%Y-%m-%d)-1 day" +%Y-%m-%d)

  #       if [ $(date -d $endD +%s) -lt $now ]; then
  #         endDate=$endD
  #       else
  #         endDate=$(date -d "$(date +%Y-%m-%d)-1 day" +%Y-%m-%d)
  #       fi
  #       startDate=$(date -d $j$i"01" +%Y-%m-%d)
  #       echo $startDate $endDate
  #       curl --request GET \
  #       --connect-timeout 1000000000 \
  #       --url 'http://'$1':3009/xray/syncXrayBaseData?startDate='$startDate'&endDate='$endDate''
  #       echo \n
  #     fi
  #   done
  # done

  echo "[done]"
}

sync_spending(){
  start=$(date -d "$201" +%Y-%m-%d)
  end=$(date -d "$301+1 month" +%Y-%m-%d)
  echo 'start sync spending: '$start' ~ '$end
  cur=$start
  while [[ "$cur" < "$end" ]]
  do
    nxt=$(date -d "$cur+1 month" +%Y-%m-%d)
    echo $cur" ~ "$nxt
    curl --request GET \
      --connect-timeout 1000000000 \
      --url 'http://'$1':3009/spending/syncSpendingType?startDate='$cur'&endDate='$nxt''
    curl --request GET \
      --connect-timeout 1000000000 \
      --url 'http://'$1':3009/spending/syncSpendingBaseData?startDate='$cur'&endDate='$nxt''
    cur=$nxt
  done
  echo "[done]"
}
sync_setting(){
  echo 'start sync setting'
  curl --request GET \
    --connect-timeout 1000000000 \
    --url 'http://'$1':3009/setting/syncSettingType'
  echo "[done]"
}


sync_xray_dropdown(){

  echo "sync xray drop down start"
  curl --request GET \
    --connect-timeout 1000000000 \
    --url 'http://'$1':3009/xray/syncxrayBaseData'
  echo "[done]"
}

help () {
    echo "******************************************"
    echo "*                                        *"
    echo "*              Choose Menu               *"
    echo "*                                        *"
    echo "******************************************"
    echo "*                                        *"
    echo "*   1. sync plm cbg finance DB           *"
    echo "*   2. sync xray                         *"
    echo "*   3. sync spending                     *"
    echo "*   4. sync xray drop down               *"
    echo "*   5. sync setting                      *"
    echo "******************************************"
}

case "$1" in

    1)
      sync_all "$2" "$3" "$4"
    ;;
    2)
      sync_xray "$2" "$3" "$4"
    ;;
    3)
      sync_spending "$2" "$3" "$4"
    ;;
    4)
      sync_xray_dropdown "$2"
    ;;
    5)
      sync_setting "$2"
    ;;
    *)
    help
    exit 1
    ;;
esac
exit 0

