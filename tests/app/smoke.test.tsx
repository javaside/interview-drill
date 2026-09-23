import { render, screen } from '@testing-library/react'

function Hello() { return <p>你好</p> }

test('jsdom project 能渲染 React 组件', () => {
  render(<Hello />)
  expect(screen.getByText('你好')).toBeInTheDocument()
})
