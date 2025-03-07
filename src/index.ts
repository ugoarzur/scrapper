import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import axios from 'axios'

import { urls, allowedTypes } from '../config.json'

const IMAGES_DIR = path.join(__dirname, '..', 'images')
const VISITED_URLS = path.join(__dirname, 'visited.json')

function loadVisitedUrls(): Set<string> {
  if (fs.existsSync(VISITED_URLS)) {
    return new Set(JSON.parse(fs.readFileSync(VISITED_URLS, 'utf-8')))
  }
  return new Set()
}

function saveVisitedUrls(visited: Set<string>) {
  fs.writeFileSync(VISITED_URLS, JSON.stringify(Array.from(visited), null, 2))
}

async function downloadImage(url: string, folder: string, filename: string) {
  try {
    const response = await axios({ url, responseType: 'arraybuffer' })
    fs.writeFileSync(path.join(folder, filename), response.data)
  } catch (error) {
    console.error(`Error while downloading from ${url}:`, error)
  }
}

async function scrapeImages(url: string) {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'load', timeout: 0 })

  const images: string[] = await page.evaluate((allowedTypes) => {
    return Array.from(document.images)
      .map((img) => img.src)
      .filter(
        (src) =>
          src && allowedTypes.some((ext) => src.toLowerCase().endsWith(ext))
      )
  }, allowedTypes)

  const pageFolder: string = path.join(
    IMAGES_DIR,
    new URL(url).hostname.replace(/\W+/g, '_')
  )
  if (!fs.existsSync(pageFolder)) {
    fs.mkdirSync(pageFolder, { recursive: true })
  }

  for (const imageUrl of images) {
    const filename = path.basename(new URL(imageUrl).pathname)
    await downloadImage(imageUrl, pageFolder, filename)
  }
  await browser.close()
}

;(async () => {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR)
  }
  const visitedUrls: Set<string> = loadVisitedUrls()

  for (const url of urls) {
    if (visitedUrls.has(url)) {
      console.log(`Skipping ${url}, already visited 👍.`)
      continue
    }

    console.log(`Scraping ${url}...`)
    await scrapeImages(url)
    visitedUrls.add(url)
    saveVisitedUrls(visitedUrls)
  }
  console.log('Scraping finished ✅')
})()
