export type SlideType = 'title' | 'section_header' | 'content'

export interface SlideData {
  slide_type: SlideType
  title: string
  bullets: string[]
}

export interface GenerateResult {
  file_id: string
  filename: string
  slide_count: number
  thumbnail_count: number
  slides: SlideData[]
}

export interface EditSlideResult {
  index: number
  slide: SlideData
  thumbnail_count: number
}

export type AppState = 'idle' | 'generating' | 'done' | 'error'
