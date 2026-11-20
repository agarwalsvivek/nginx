import { Link, Route, Routes } from 'react-router'
import './App.css'
import { useEffect, useState } from 'react'

const Home = () => {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('http://localhost:3000/api/hello')
      .then((res) => res.json())
      .then(setData)
      .catch((err) => setError(err.message))
  }, [])

  return (
    <>
      <h1>Home</h1>
      {data && <p>{data.message}</p>}
      {error && <p>Error: {error}</p>}
    </>
  )
}

const About = () => {
  return <h1>About</h1>
}

function App() {
  return (
      <section id="center">
        
       <nav>
          <Link to="/">Home</Link> | <Link to="/about">About</Link>
        </nav>
        <Routes>
          <Route path="/" element={<Home/>}/>
          <Route path="/about" element={<About/>}/>
        </Routes>
       
      </section>
  )
}

export default App
