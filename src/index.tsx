import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { RegExpRouter } from 'hono/router/reg-exp-router'
import pg from 'pg'
import type { FC } from 'hono/jsx'
import { randomUUID } from 'crypto'
import { createMiddleware } from 'hono/factory'
import { methodOverride } from 'hono/method-override'
import { css, Style } from 'hono/css'

const { Pool } = pg

const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_DB } = process.env

const pool = new Pool({
  user: POSTGRES_USER,
  password: POSTGRES_PASSWORD,
  host: POSTGRES_HOST,
  port: 5432,
  database: POSTGRES_DB
})

type Env = {
  Variables: {
    database: pg.Pool
  }
}
const app = new Hono<Env>({ router: new RegExpRouter() })

const middleWare = createMiddleware(async (c, next) => {
  c.set("database", pool)
  await next()
})

app.use(middleWare)
app.use('/:uuid', methodOverride({ app }))

interface Todo {
  uuid: string
  task: string
}

const Todos: FC<{ tasks: Todo[] }> = async ({ tasks }: { tasks: Todo[] }) => {

  const listClass = css`
    display: flex;
    flex-direction: column;
    list-style: none;
    margin: 0;
    padding: 0;
  `

  const itemClass = css`
    display: flex;
    justify-content: space-between;
    padding: 5px;
    background-color: salmon;
    &:nth-child(even) {
      background-color: aliceblue;
    }
  `
  const formClass = css`
    margin: 0;
  `

  return (
    <ul class={listClass}>
      { tasks.map(({uuid, task}) => (
        <li class={itemClass}>
          {task}
          <form action={`/${uuid}`} method='post' class={formClass}>
            <input type={'hidden'} name='_method' value={'delete'} />
            <input type={'submit'} value={'x'} />
          </form>
        </li>
      ))}
    </ul>
  )
}

const AddTodo: FC = () => {

  const formClass = css`
    display: flex;
    justify-content: space-between;
    width: 100%;
    margin-top: 10px;
  `

  return (
    <form action='/' method='post' class={formClass}>
      <input type={'text'} name='task'></input>
      <input type={'submit'} value={'Add'} />
    </form>
  )
}

app.get('/', async (c) => {
  const { rows: todos } = await c.get("database").query('SELECT * from todos')

  const bodyClass = css`
    background-color: papayawhip;
    margin: 0;
    padding: 0;
    font: 1.2rem "Fira Sans", sans-serif;
  `
  const containerClass = css`
    width: 200px;
    margin: 20vh auto 0 auto;
    padding: 20px;
    background-color: white;
    border-radius: 5px;
    box-shadow: 5px 5px 5px rgba(0,0,0,0.3);
  `
  const headerClass = css`
    margin: 0 0 20px 0;
    padding: 0;
  `

  return c.html(
    <html>
      <head>
        <Style />
      </head>
      <body class={bodyClass}>
        <div class={containerClass}>
          <h1 class={headerClass}>Todos</h1>
          <Todos tasks={todos} />
          <AddTodo />
        </div>
      </body>
    </html>
  )
})

app.post('/', async (c) => {
  const body = await c.req.parseBody()
  const todo = {
    uuid: randomUUID(),
    task: body['task']
  }

  await c.get("database").query('INSERT INTO todos(uuid, task) VALUES($1, $2)', [todo.uuid, todo.task])

  return c.redirect('/')

})

app.delete("/:uuid", async (c) => {
  const uuid = c.req.param('uuid')

  await c.get("database").query("DELETE FROM todos where uuid = $1", [uuid])

  return c.redirect('/')
})

const port = 3000
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})
