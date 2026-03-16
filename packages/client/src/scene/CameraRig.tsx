import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Target positions: idle (far, elevated) → connected (closer, isometric-ish)
const IDLE_POS = new THREE.Vector3(10, 9, 13)
const CONNECTED_POS = new THREE.Vector3(8, 7, 10)
const LERP_SPEED = 0.035

interface CameraRigProps {
  connected: boolean
}

export function CameraRig({ connected }: CameraRigProps) {
  const { camera } = useThree()
  const target = useRef(connected ? CONNECTED_POS.clone() : IDLE_POS.clone())

  useEffect(() => {
    target.current = connected ? CONNECTED_POS.clone() : IDLE_POS.clone()
  }, [connected])

  useFrame(() => {
    camera.position.lerp(target.current, LERP_SPEED)
  })

  return null
}
