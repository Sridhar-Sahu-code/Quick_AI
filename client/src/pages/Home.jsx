import React from 'react'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import AITool from '../components/AITool'
import Testimonial from '../components/Testimonial'
import Plan from '../components/Plan'
import Footer from '../components/Footer'
import CreationItem from '../components/CreationItem'

const Home = () => {
  return (
    <>
      <Navbar/>
      <Hero/>
      <AITool/>
      <Testimonial/>
      <Plan/>
      <Footer/>
      <CreationItem/>
    </>
  )
}

export default Home
