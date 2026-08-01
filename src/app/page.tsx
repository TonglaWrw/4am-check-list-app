import RaidBoard from '@/components/RaidBoard'

export default function Home() {
  return (
    <RaidBoard
      zoneNames={['TeamA', 'TeamB', 'TeamC']}
      showSpecial
      navLinks={[{ label: 'ซ้อม30-30', href: '/sim3030' }]}
    />
  )
}
