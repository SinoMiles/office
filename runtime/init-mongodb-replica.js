try {
  const status = rs.status();
  if (status.ok === 1) {
    print("REPLICA_SET_ALREADY_INITIALIZED");
  }
} catch (error) {
  printjson(rs.initiate({
    _id: "rs0",
    members: [{ _id: 0, host: "127.0.0.1:27017" }],
  }));
}
