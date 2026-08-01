import RaidBoard from '@/components/RaidBoard'

export default function Sim3030() {
  return (
    <RaidBoard
      zoneNames={['ซ้อม A', 'ซ้อม B']}
      showSpecial={false}
      navLinks={[{ label: '← หน้าแรก', href: '/' }]}
      kind="practice"
    />
  )
}
