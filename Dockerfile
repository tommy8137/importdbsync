FROM collinestes/docker-node-oracle:10-slim
COPY ./ /usr/local/db-sync
WORKDIR /usr/local/db-sync
# Contains only necessary libs from oracle instant client:
# "*/libociei.so */libons.so */libnnz12.so */libclntshcore.so.12.1 */libclntsh.so.12.1"
# RUN  mv instantclientlibs-linux.x64-12.1.0.1.0.tar.gz  /usr/lib
# # libaio and libnsl are necessary for oracledb
# RUN echo "http://dl-cdn.alpinelinux.org/alpine/v3.8/main" > /etc/apk/repositories && \
#     echo "http://dl-cdn.alpinelinux.o/alpine/v3.8/community" >> /etc/apk/repositories && \
#     apk add --no-cache libaio libnsl unzip  && \
#     cd /usr/lib && \
#     ln -s /usr/lib/libnsl.so.2 /usr/lib/libnsl.so.1 && \
#     tar xf instantclientlibs-linux.x64-12.1.0.1.0.tar.gz && \
#     ln -s /usr/lib/libclntsh.so.12.1 /usr/lib/libclntsh.so && \
#     rm  instantclientlibs-linux.x64-12.1.0.1.0.tar.gz

RUN cd /usr/local/db-sync
RUN npm install
EXPOSE  3009

ENTRYPOINT echo $1 $2 >> /etc/hosts && /usr/local/bin/npm run $0 $@
