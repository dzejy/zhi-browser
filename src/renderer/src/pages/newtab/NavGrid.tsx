import React from 'react'
import type { Category } from './defaultLinks'

interface NavGridProps {
  categories: Category[]
  isEditMode: boolean
  onEditCategory: (catIdx: number) => void
  onEditLink: (catIdx: number, linkIdx: number) => void
  onNavigate: (url: string) => void
}

export const NavGrid: React.FC<NavGridProps> = ({
  categories,
  isEditMode,
  onEditCategory,
  onEditLink,
  onNavigate
}) => {
  return (
    <div className="nav-area">
      {categories.map((cat, ci) => (
        <div key={ci} className="nav-card">
          <div
            className="card-title"
            onClick={(e) => {
              if (isEditMode) {
                e.preventDefault()
                onEditCategory(ci)
              }
            }}
          >
            <span>{cat.name}</span>
            <span
              className="edit-icon"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onEditCategory(ci)
              }}
            >
              ✎
            </span>
          </div>
          <div className="card-links">
            {cat.links.map((link, li) => (
              <a
                key={li}
                className="card-link"
                href={link.url}
                onClick={(e) => {
                  e.preventDefault()
                  if (isEditMode) {
                    onEditLink(ci, li)
                  } else {
                    onNavigate(link.url)
                  }
                }}
              >
                {link.name}
                <span
                  className="edit-icon"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onEditLink(ci, li)
                  }}
                >
                  ✎
                </span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
