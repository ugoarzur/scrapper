import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import axios from 'axios'

import { urls, allowedTypes } from '../config.json'

const IMAGES_DIR = path.join(__dirname, '..', 'images')

async function downloadImage(url: string, folder: string, filename: string) {
  try {
    const response = await axios({ url, responseType: 'arraybuffer' })
    fs.writeFileSync(path.join(folder, filename), response.data)
  } catch (error) {
    console.error(`Erreur lors du téléchargement de ${url}:`, error)
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

  for (const url of urls) {
    console.log(`Scraping ${url}...`)
    await scrapeImages(url)
  }
  console.log('Scraping terminé.')
})()
