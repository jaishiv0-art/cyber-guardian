import './Skeleton.css'

export function Skeleton({ w = '100%', h = '14px', radius = '6px', style = {} }) {
  return (
    <span
      className="g-skeleton"
      style={{ width: w, height: h, borderRadius: radius, ...style }}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="g-skeleton-card">
      <Skeleton w="40%" h="12px" />
      <Skeleton w="70%" h="20px" style={{ marginTop: 10 }} />
      <Skeleton w="100%" h="10px" style={{ marginTop: 18 }} />
      <Skeleton w="90%" h="10px" style={{ marginTop: 8 }} />
    </div>
  )
}
