import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { FLOOR_H } from './constants'

const IDLE_POS      = new THREE.Vector3(10, 9, 13)
const CONNECTED_POS = new THREE.Vector3(8, 7, 10)
const CENTER_Y      = 3   // default orbit target Y (mid-building)
const LERP_CAM      = 0.035
const LERP_TARGET   = 0.05

interface CameraRigProps {
  connected: boolean
  selectedFloor: number | null
}

export function CameraRig({ connected, selectedFloor }: CameraRigProps) {
  const { camera } = useThree()
  const controlsRef  = useRef<OrbitControlsImpl>(null)
  const targetCamPos = useRef(connected ? CONNECTED_POS.clone() : IDLE_POS.clone())
  const targetLookAt = useRef(new THREE.Vector3(0, CENTER_Y, 0))

  useEffect(() => {
    if (selectedFloor !== null) {
      // Fly in closer at the selected floor's height
      const floorY = selectedFloor * FLOOR_H + FLOOR_H / 2
      targetCamPos.current.set(6, floorY + 2.5, 8)
      targetLookAt.current.set(0, floorY, 0)
    } else {
      targetCamPos.current.copy(connected ? CONNECTED_POS : IDLE_POS)
      targetLookAt.current.set(0, CENTER_Y, 0)
    }
  }, [connected, selectedFloor])

  useFrame(() => {
    // Move camera position
    camera.position.lerp(targetCamPos.current, LERP_CAM)

    // Move orbit pivot to follow the selected floor
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLookAt.current, LERP_TARGET)
      controlsRef.current.update()
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minPolarAngle={0.2}
      maxPolarAngle={Math.PI / 2.2}
      minDistance={4}
      maxDistance={25}
    />
  )
}
