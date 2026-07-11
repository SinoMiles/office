async function run() {
  const payload = {
    type: "aionrs",
    name: "test",
    model: {
      id: "prov_019f5283-4e34-70c2-926f-d65ca6f157e1",
      platform: "deepseek",
      name: "DeepSeek",
      base_url: "https://api.deepseek.com",
      api_key: "test",
      use_model: "deepseek-v4-flash"
    },
    extra: {}
  };

  const res = await fetch('http://127.0.0.1:9123/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  console.log(res.status, await res.text());
}
run();
