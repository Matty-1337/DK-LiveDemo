# LiveDemo backend uses MongoDB change streams (requires a replica set).
# Deploy this on Railway: connect the `livedemo-mongo` service to this
# directory from the GitHub repo, or set **Custom start command** on the
# `mongo:8` image to:  mongod --replSet rs0 --bind_ip_all
FROM mongo:8
CMD ["mongod", "--replSet", "rs0", "--bind_ip_all"]
