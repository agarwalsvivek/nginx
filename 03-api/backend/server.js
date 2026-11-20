const express = require('express')
const app = express()

// Log every request, so you can see whether it actually reached the backend
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`)
  next()
})

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the backend', time: new Date().toISOString() })
})

app.listen(3000, () => console.log('API running on http://localhost:3000'))
