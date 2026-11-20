const express = require('express')
const app = express()

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the backend', time: new Date().toISOString() })
})

app.listen(3000, () => console.log('API running on http://localhost:3000'))
