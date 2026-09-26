<script setup lang="ts">
import { landingMotionMode } from '~/utils/landing-motion'

type Particle = { x: number; y: number; size: number; speed: number }
type CanvasState = {
  host: HTMLElement
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  particles: Particle[]
  visible: boolean
  width: number
  height: number
  light: boolean
}

let root: HTMLElement | null = null
let heroArt: HTMLElement | null = null
let marquee: HTMLElement | null = null
let reducedQuery: MediaQueryList | null = null
let pointerQuery: MediaQueryList | null = null
let hostObserver: IntersectionObserver | null = null
let revealObserver: IntersectionObserver | null = null
let marqueeObserver: IntersectionObserver | null = null
let resizeObserver: ResizeObserver | null = null
let frameId: number | null = null
let pointerListening = false
let marqueeVisible = false
const hosts: CanvasState[] = []

function modeFor(state: CanvasState) {
  return landingMotionMode({
    reducedMotion: reducedQuery?.matches ?? true,
    finePointer: pointerQuery?.matches ?? false,
    inViewport: state.visible,
    pageVisible: document.visibilityState === 'visible',
  })
}

function resizeCanvas(state: CanvasState) {
  const { width, height } = state.host.getBoundingClientRect()
  state.width = width
  state.height = height
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  state.canvas.width = Math.max(1, Math.round(width * dpr))
  state.canvas.height = Math.max(1, Math.round(height * dpr))
  state.context.setTransform(dpr, 0, 0, dpr, 0, 0)
  const count = Math.max(24, Math.min(110, Math.round((width * height) / 8200)))
  state.particles = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: 0.8 + Math.random() * 1.7,
    speed: 0.14 + Math.random() * 0.35,
  }))
}

function draw(state: CanvasState) {
  const { context, width, height } = state
  context.clearRect(0, 0, width, height)
  context.fillStyle = state.light ? 'rgba(255,255,255,0.58)' : 'rgba(36,55,201,0.34)'
  for (const particle of state.particles) {
    particle.y -= particle.speed
    if (particle.y < -4) {
      particle.y = height + 4
      particle.x = Math.random() * width
    }
    context.beginPath()
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
    context.fill()
  }
}

function tick() {
  frameId = null
  const active = hosts.filter(
    (state) => state.width > 0 && state.height > 0 && modeFor(state).particles,
  )
  if (active.length === 0) {
    updateMotion()
    return
  }
  for (const state of active) draw(state)
  frameId = requestAnimationFrame(tick)
}

function onPointerMove(event: PointerEvent) {
  if (!heroArt) return
  const rect = heroArt.getBoundingClientRect()
  const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2))
  const y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2))
  heroArt.style.setProperty('--landing-shift-x', `${(x * 9).toFixed(1)}px`)
  heroArt.style.setProperty('--landing-shift-y', `${(y * 9).toFixed(1)}px`)
  heroArt.style.setProperty('--landing-cursor-x', `${((x + 1) * 50).toFixed(1)}%`)
  heroArt.style.setProperty('--landing-cursor-y', `${((y + 1) * 50).toFixed(1)}%`)
}

function resetPointer() {
  heroArt?.style.setProperty('--landing-shift-x', '0px')
  heroArt?.style.setProperty('--landing-shift-y', '0px')
}

function updateMotion() {
  const running = hosts.some(
    (state) => state.width > 0 && state.height > 0 && modeFor(state).particles,
  )
  if (running && frameId === null) frameId = requestAnimationFrame(tick)
  if (!running && frameId !== null) {
    cancelAnimationFrame(frameId)
    frameId = null
  }
  if (root) root.dataset.landingRunning = String(running)
  if (reducedQuery?.matches) {
    for (const state of hosts) state.context.clearRect(0, 0, state.width, state.height)
  }

  const pointerActive = hosts.some((state) => modeFor(state).pointerEffects)
  if (heroArt && pointerActive !== pointerListening) {
    if (pointerActive) {
      heroArt.addEventListener('pointermove', onPointerMove)
      heroArt.addEventListener('pointerleave', resetPointer)
      heroArt.dataset.landingPointer = 'true'
    } else {
      heroArt.removeEventListener('pointermove', onPointerMove)
      heroArt.removeEventListener('pointerleave', resetPointer)
      delete heroArt.dataset.landingPointer
      resetPointer()
    }
    pointerListening = pointerActive
  }

  if (marquee) {
    marquee.dataset.landingMarquee =
      marqueeVisible && !reducedQuery?.matches && document.visibilityState === 'visible'
        ? 'active'
        : 'paused'
  }
}

function updateScroll() {
  if (!root) return
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
  root.style.setProperty('--landing-scroll-progress', String(Math.min(1, window.scrollY / max)))
  const sections = [...root.querySelectorAll<HTMLElement>('#features, #how-it-works, #faq')]
  const current = sections
    .filter((section) => section.getBoundingClientRect().top <= 190)
    .at(-1)?.id
  for (const anchor of root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    if (anchor.hash === `#${current}`) anchor.dataset.landingActive = 'true'
    else delete anchor.dataset.landingActive
  }
}

onMounted(() => {
  root = document.querySelector<HTMLElement>('.landing')
  if (!root) return
  heroArt = root.querySelector<HTMLElement>('.landing__hero-art')
  marquee = root.querySelector<HTMLElement>('.landing__marquee')
  reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  pointerQuery = window.matchMedia('(pointer: fine)')
  reducedQuery.addEventListener('change', updateMotion)
  pointerQuery.addEventListener('change', updateMotion)
  document.addEventListener('visibilitychange', updateMotion)
  window.addEventListener('scroll', updateScroll, { passive: true })
  window.addEventListener('resize', updateScroll, { passive: true })

  for (const host of root.querySelectorAll<HTMLElement>('[data-landing-canvas]')) {
    const canvas = document.createElement('canvas')
    canvas.setAttribute('aria-hidden', 'true')
    const context = canvas.getContext('2d')
    if (!context) continue
    host.append(canvas)
    hosts.push({
      host,
      canvas,
      context,
      particles: [],
      visible: false,
      width: 0,
      height: 0,
      light: true,
    })
  }

  if ('IntersectionObserver' in window && 'ResizeObserver' in window) {
    hostObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const state = hosts.find((item) => item.host === entry.target)
        if (state) state.visible = entry.isIntersecting
      }
      updateMotion()
    })
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const state = hosts.find((item) => item.host === entry.target)
        if (state) resizeCanvas(state)
      }
      updateMotion()
    })
    for (const state of hosts) {
      hostObserver.observe(state.host)
      resizeObserver.observe(state.host)
    }

    revealObserver = new IntersectionObserver(
      (entries, observer) => {
        if (reducedQuery?.matches) return
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          ;(entry.target as HTMLElement).dataset.landingReveal = 'true'
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.12 },
    )
    for (const element of root.querySelectorAll<HTMLElement>(
      '.landing__section-intro, .landing__feature, .landing__story-card, .landing__step-list li, .landing__role, .landing__faq-list',
    )) {
      revealObserver.observe(element)
    }

    if (marquee) {
      marqueeObserver = new IntersectionObserver((entries) => {
        marqueeVisible = entries[0]?.isIntersecting ?? false
        updateMotion()
      })
      marqueeObserver.observe(marquee)
    }
  }

  updateScroll()
  updateMotion()
})

onUnmounted(() => {
  if (frameId !== null) cancelAnimationFrame(frameId)
  frameId = null
  hostObserver?.disconnect()
  resizeObserver?.disconnect()
  revealObserver?.disconnect()
  marqueeObserver?.disconnect()
  reducedQuery?.removeEventListener('change', updateMotion)
  pointerQuery?.removeEventListener('change', updateMotion)
  document.removeEventListener('visibilitychange', updateMotion)
  window.removeEventListener('scroll', updateScroll)
  window.removeEventListener('resize', updateScroll)
  heroArt?.removeEventListener('pointermove', onPointerMove)
  heroArt?.removeEventListener('pointerleave', resetPointer)
  for (const state of hosts) state.canvas.remove()
  hosts.length = 0
  root = null
  heroArt = null
  marquee = null
  reducedQuery = null
  pointerQuery = null
})
</script>

<template>
  <div class="landing__scroll-progress" aria-hidden="true"></div>
</template>
