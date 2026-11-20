import { Link, Route, Routes } from 'react-router'
import './App.css'

const Home = () => {
  return <h1>Home</h1>
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
