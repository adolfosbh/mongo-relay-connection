import 'babel-polyfill'
import assert from 'assert'
import { graphql } from 'graphql'
import {
  sortBy,
  pick
} from 'lodash'
import { expect } from 'chai'
import Starship from './models/starship'
import Product from './models/product'
import schema from './schema/schema'
import starshipsJSON from './data/starships.json'
import foodTypes from './data/foodTypes.json'
import productsJSON from './data/products.json'

const starshipsRef = sortBy(starshipsJSON.data.allStarships.edges, x => x.node.starshipClass)
const foodRef = sortBy(productsJSON.filter(x => foodTypes.indexOf(x.type) > -1), x => -x.price)

describe('mongo data', () => {
  it('should fetch correct number of starships from mongo', async () => {
    const cnt = await Starship.count()
    assert(cnt === 36)
  })

  it('should fetch correct number of products from mongo', async () => {
    const cnt = await Product.count()
    assert(cnt === 300)
  })

  it('should fetch correct number of food products from mongo', async () => {
    const cnt = await Product.count({
      type: { $in: foodTypes }
    })
    assert(cnt === 102)
  })
})

describe('totalCount', () => {
  it('should fetch correct total counts', async () => {
    const query = `
      {
        allStarships {
          totalCount
        }
        allFoodProducts {
          totalCount
        }
      }
    `
    const res = await graphql(schema, query)
    const { allStarships, allFoodProducts } = res.data
    expect(allStarships.totalCount).to.equal(36)
    expect(allFoodProducts.totalCount).to.equal(102)
  })
})

describe('pageInfo', () => {
  it('should fetch non-null page info', async () => {
    const query = `
      {
        allStarships {
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
        allFoodProducts {
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `
    const expectNonNull = pageInfo => {
      const { hasNextPage, hasPreviousPage, startCursor, endCursor } = pageInfo
      assert(!hasNextPage)
      assert(!hasPreviousPage)
      assert(startCursor)
      assert(endCursor)
    }
    const res = await graphql(schema, query)
    expectNonNull(res.data.allStarships.pageInfo)
    expectNonNull(res.data.allFoodProducts.pageInfo)
  })
})

describe('edges', () => {
  it('should fetch all nodes in proper sort order', async () => {
    const query = `
      {
        allStarships {
          edges {
            node {
              model
              starshipClass
            }
          }
        }
        allFoodProducts {
          edges {
            node {
              name
              type
              price
            }
          }
        }
      }
    `
    const res = await graphql(schema, query)
    const { allStarships, allFoodProducts } = res.data
    expect(allStarships.edges).to.deep.equal(starshipsRef)
    expect(allFoodProducts.edges.map(x => x.node)).to.deep.equal(foodRef)
  })
})

describe('transverse forward', () => {
  it('should tranverse forward via page info cursor for all starships', async () => {
    const query = (first, after) => {
      return `
        {
          allStarships(first: ${first}, after: "${after}") {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              node {
                model
                starshipClass
              }
            }
          }
        }
      `
    }

    const query1 = query(1, '')
    let res = await graphql(schema, query1)
    let { pageInfo, edges } = res.data.allStarships
    let { hasNextPage, endCursor } = pageInfo
    assert(hasNextPage)
    assert(endCursor)
    expect(edges).to.deep.equal(starshipsRef.slice(0, 1))

    const query2 = query(10, endCursor)
    res = await graphql(schema, query2)
    pageInfo = res.data.allStarships.pageInfo
    edges = res.data.allStarships.edges
    assert(pageInfo.hasNextPage)
    assert(pageInfo.endCursor)
    expect(edges).to.deep.equal(starshipsRef.slice(1, 11))

    const query3 = query(10, pageInfo.endCursor)
    res = await graphql(schema, query3)
    pageInfo = res.data.allStarships.pageInfo
    edges = res.data.allStarships.edges
    assert(pageInfo.hasNextPage)
    assert(pageInfo.endCursor)
    expect(edges).to.deep.equal(starshipsRef.slice(11, 21))

    const query4 = query(10, pageInfo.endCursor)
    res = await graphql(schema, query4)
    pageInfo = res.data.allStarships.pageInfo
    edges = res.data.allStarships.edges
    assert(pageInfo.hasNextPage)
    assert(pageInfo.endCursor)
    expect(edges).to.deep.equal(starshipsRef.slice(21, 31))

    const query5 = query(10, pageInfo.endCursor)
    res = await graphql(schema, query5)
    pageInfo = res.data.allStarships.pageInfo
    edges = res.data.allStarships.edges
    assert(!pageInfo.hasNextPage)
    assert(pageInfo.startCursor)
    assert(pageInfo.endCursor)
    expect(edges).to.deep.equal(starshipsRef.slice(31))

    const query6 = query(10, pageInfo.endCursor)
    res = await graphql(schema, query6)
    pageInfo = res.data.allStarships.pageInfo
    edges = res.data.allStarships.edges
    assert(!pageInfo.hasNextPage)
    assert(!pageInfo.startCursor)
    assert(!pageInfo.endCursor)
    expect(edges.length).to.equal(0)
  })

  it('should tranverse forward via page info cursor for all food product', async () => {
    const query = (first, after) => {
      return `
        {
          allFoodProducts(first: ${first}, after: "${after}") {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              node {
                name
                type
                price
              }
            }
          }
        }
      `
    }

    const query1 = query(25, '')
    let res = await graphql(schema, query1)
    let { pageInfo, edges } = res.data.allFoodProducts
    let { hasNextPage, endCursor } = pageInfo
    assert(hasNextPage)
    assert(endCursor)
    expect(edges.map(x => x.node)).to.deep.equal(foodRef.slice(0, 25))

    const query2 = query(25, endCursor)
    res = await graphql(schema, query2)
    pageInfo = res.data.allFoodProducts.pageInfo
    edges = res.data.allFoodProducts.edges
    assert(pageInfo.hasNextPage)
    assert(pageInfo.endCursor)
    expect(edges.map(x => x.node)).to.deep.equal(foodRef.slice(25, 50))

    const query3 = query(25, pageInfo.endCursor)
    res = await graphql(schema, query3)
    pageInfo = res.data.allFoodProducts.pageInfo
    edges = res.data.allFoodProducts.edges
    assert(pageInfo.hasNextPage)
    assert(pageInfo.endCursor)
    expect(edges.map(x => x.node)).to.deep.equal(foodRef.slice(50, 75))

    const query4 = query(25, pageInfo.endCursor)
    res = await graphql(schema, query4)
    pageInfo = res.data.allFoodProducts.pageInfo
    edges = res.data.allFoodProducts.edges
    assert(pageInfo.hasNextPage)
    assert(pageInfo.endCursor)
    expect(edges.map(x => x.node)).to.deep.equal(foodRef.slice(75, 100))

    const query5 = query(25, pageInfo.endCursor)
    res = await graphql(schema, query5)
    pageInfo = res.data.allFoodProducts.pageInfo
    edges = res.data.allFoodProducts.edges
    assert(!pageInfo.hasNextPage)
    assert(pageInfo.endCursor)
    expect(edges.map(x => x.node)).to.deep.equal(foodRef.slice(100))

    const query6 = query(25, pageInfo.endCursor)
    res = await graphql(schema, query6)
    pageInfo = res.data.allFoodProducts.pageInfo
    edges = res.data.allFoodProducts.edges
    assert(!pageInfo.hasNextPage)
    assert(!pageInfo.startCursor)
    assert(!pageInfo.endCursor)
    expect(edges.length).to.equal(0)
  })
})

describe('transverse backward', () => {
  it('should transverse backward via page info cursor for all starships', async () => {
    const query = before => {
      return `
        {
          allStarships(last: 10, before: "${before}") {
            pageInfo {
              hasPreviousPage
              startCursor
            }
            edges {
              node {
                model
                starshipClass
              }
            }
          }
        }
      `
    }

    const query1 = `
      {
        allStarships {
          pageInfo {
            endCursor
          }
        }
      }
    `
    let res = await graphql(schema, query1)
    let { endCursor } = res.data.allStarships.pageInfo
    assert(endCursor)

    const query2 = query(endCursor)
    res = await graphql(schema, query2)
    let { pageInfo, edges } = res.data.allStarships
    assert(pageInfo.hasPreviousPage)
    assert(pageInfo.startCursor)
    expect(edges).to.deep.equal(starshipsRef.slice(25, 35))

    const query3 = query(pageInfo.startCursor)
    res = await graphql(schema, query3)
    pageInfo = res.data.allStarships.pageInfo
    edges = res.data.allStarships.edges
    assert(pageInfo.hasPreviousPage)
    assert(pageInfo.startCursor)
    expect(edges).to.deep.equal(starshipsRef.slice(15, 25))

    const query4 = query(pageInfo.startCursor)
    res = await graphql(schema, query4)
    pageInfo = res.data.allStarships.pageInfo
    edges = res.data.allStarships.edges
    assert(pageInfo.hasPreviousPage)
    assert(pageInfo.startCursor)
    expect(edges).to.deep.equal(starshipsRef.slice(5, 15))

    const query5 = query(pageInfo.startCursor)
    res = await graphql(schema, query5)
    pageInfo = res.data.allStarships.pageInfo
    edges = res.data.allStarships.edges
    assert(!pageInfo.hasPreviousPage)
    assert(pageInfo.startCursor)
    expect(edges).to.deep.equal(starshipsRef.slice(0, 5))

    const query6 = query(pageInfo.startCursor)
    res = await graphql(schema, query6)
    pageInfo = res.data.allStarships.pageInfo
    assert(!pageInfo.hasPreviousPage)
    assert(!pageInfo.startCursor)
  })

  it('should transverse backward via page info cursor for all food product', async () => {
    const query = before => {
      return `
        {
          allFoodProducts(last: 25, before: "${before}") {
            pageInfo {
              hasPreviousPage
              startCursor
            }
            edges {
              node {
                name
                type
                price
              }
            }
          }
        }
      `
    }

    const query1 = `
      {
        allFoodProducts {
          pageInfo {
            endCursor
          }
        }
      }
    `

    let res = await graphql(schema, query1)
    let { endCursor } = res.data.allFoodProducts.pageInfo
    assert(endCursor)

    const query2 = query(endCursor)
    res = await graphql(schema, query2)
    let { pageInfo, edges } = res.data.allFoodProducts
    assert(pageInfo.hasPreviousPage)
    assert(pageInfo.startCursor)
    expect(edges.map(x => x.node)).to.deep.equal(foodRef.slice(76, 101))

    const query3 = query(pageInfo.startCursor)
    res = await graphql(schema, query3)
    pageInfo = res.data.allFoodProducts.pageInfo
    edges = res.data.allFoodProducts.edges
    assert(pageInfo.hasPreviousPage)
    assert(pageInfo.startCursor)
    expect(edges.map(x => x.node)).to.deep.equal(foodRef.slice(51, 76))

    const query4 = query(pageInfo.startCursor)
    res = await graphql(schema, query4)
    pageInfo = res.data.allFoodProducts.pageInfo
    edges = res.data.allFoodProducts.edges
    assert(pageInfo.hasPreviousPage)
    assert(pageInfo.startCursor)
    expect(edges.map(x => x.node)).to.deep.equal(foodRef.slice(26, 51))

    const query5 = query(pageInfo.startCursor)
    res = await graphql(schema, query5)
    pageInfo = res.data.allFoodProducts.pageInfo
    edges = res.data.allFoodProducts.edges
    assert(pageInfo.hasPreviousPage)
    assert(pageInfo.startCursor)
    expect(edges.map(x => x.node)).to.deep.equal(foodRef.slice(1, 26))

    const query6 = query(pageInfo.startCursor)
    res = await graphql(schema, query6)
    pageInfo = res.data.allFoodProducts.pageInfo
    edges = res.data.allFoodProducts.edges
    expect(edges[0].node).to.deep.equal(foodRef[0])
    assert(!pageInfo.hasPreviousPage)
    assert(pageInfo.startCursor)

    const query7 = query(pageInfo.startCursor)
    res = await graphql(schema, query7)
    pageInfo = res.data.allFoodProducts.pageInfo
    assert(!pageInfo.hasPreviousPage)
    assert(!pageInfo.startCursor)
  })
})

describe('first', () => {
  it('should fetch the first n items after the cursor', async () => {
    const n = 3

    const query = after => {
      return `
        {
          allStarships (first: ${n}, after: "${after}") {
            edges {
              node {
                model
                starshipClass
              }
              cursor
            }
          }
        }
      `
    }

    const res = await graphql(schema, query(''))
    const { edges } = res.data.allStarships
    expect(edges.map(e => pick(e, ['node']))).to.deep.equal(starshipsRef.slice(0, n))

    const res2 = await graphql(schema, query(edges[n - 1].cursor))
    const edges2 = res2.data.allStarships.edges
    expect(edges2.map(e => pick(e, ['node']))).to.deep.equal(starshipsRef.slice(n, n * 2))
  })
})

describe('first + after on non-unique field', () => {
  it('should fetch the first n items after the cursor', async () => {
    const query = (first, after) => {
      return `
        {
          allStarships (first: ${first}, after: "${after}") {
            edges {
              node {
                model
                starshipClass
              }
              cursor
            }
          }
        }
      `
    }

    const res = await graphql(schema, query(16, ''))
    const { edges } = res.data.allStarships

    const res2 = await graphql(schema, query(3, edges[15].cursor))
    const edges2 = res2.data.allStarships.edges
    expect(edges2.map(e => pick(e, ['node']))).to.deep.equal(starshipsRef.slice(16, 19))
  })
})

describe('last + before on non-unique field', () => {
  it('should fetch the last n items before the cursor', async () => {
    const pageQuery = `
      {
        allStarships (first: 30) {
          pageInfo {
            endCursor
          }
        }
      }
    `
    const pageRes = await graphql(schema, pageQuery)
    const { endCursor } = pageRes.data.allStarships.pageInfo

    const query = `
      {
        allStarships (last: 6, before: "${endCursor}") {
          edges {
            node {
              model
              starshipClass
            }
            cursor
          }
        }
      }
    `
    const res = await graphql(schema, query)
    const { edges } = res.data.allStarships
    expect(edges.map(e => pick(e, ['node']))).to.deep.equal(starshipsRef.slice(23, 29))
  })
})
