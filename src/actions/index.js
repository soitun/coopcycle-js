import localforage from 'localforage'
import Client from '../client'

export const addToCart = menuItem => {
  return { type: 'ADD_TO_CART', menuItem }
}

export const removeFromCart = cartItem => {
  return { type: 'REMOVE_FROM_CART', cartItem }
}

const loadCartItems = () => {
  return localforage.getItem('cartItems')
}

const loadCartAddress = () => {
  return localforage.getItem('cartAddress')
}

const loadUser = () => {
  return localforage.getItem('user')
}

const loadRestaurant = (client, restaurantId) => {
  return client.get('/api/restaurants/' + restaurantId)
}

export const initialize = (baseURL, restaurantId) => (dispatch, getState) => {
  localforage.getItem('coopcyle__api_credentials')
    .then(credentials => {
      const client = new Client(baseURL, credentials)

      Promise.all([ loadRestaurant(client, restaurantId), loadCartItems(), loadCartAddress(), loadUser() ])
        .then(values => {
          const [ restaurant, cartItems, cartAddress, user ] = values;
          dispatch({ type: 'INITIALIZE', client, cartItems, cartAddress, user, restaurant })
        })
    })
}

const authenticationSuccess = (dispatch, getState, credentials) => {
  getState().client.get('/api/me')
    .then(user => dispatch({ type: 'AUTHENTICATION_SUCCESS', user, credentials }))
}

export const authenticate = (username, password) => (dispatch, getState) => {
  dispatch({ type: 'AUTHENTICATION_REQUEST' });
  getState().client
    .login(username, password)
    .then(credentials => authenticationSuccess(dispatch, getState, credentials))
    .catch(err => dispatch({ type: 'AUTHENTICATION_FAILURE' }))
}

export const register = (email, username, password) => (dispatch, getState) => {
  dispatch({ type: 'REGISTRATION_REQUEST' });
  getState().client
    .register(email, username, password)
    .then(credentials => authenticationSuccess(dispatch, getState, credentials))
    .catch(err => dispatch({ type: 'REGISTRATION_FAILURE' }))
}

export const disconnect = (username, password) => (dispatch, getState) => {
  localforage.removeItem('user')
    .then(() => localforage.removeItem('credentials'))
    .then(() => dispatch({ type: 'DISCONNECT' }))
}

export const pickAddress = (address) => {
  return { type: 'PICK_ADDRESS', address };
}

export const toggleAddressForm = () => {
  return { type: 'TOGGLE_ADDRESS_FORM' };
}

const createAddress = (client, payload) => {
  return client.post('/api/me/addresses', payload)
}

const createOrderPayload = (restaurant, cartItems, cartAddress) => {
  const orderedItem = _.map(cartItems, (item) => {
    return {
      quantity: item.quantity,
      menuItem: item.menuItem['@id']
    }
  });

  return {
    restaurant: restaurant['@id'],
    orderedItem: orderedItem,
    delivery: {
      deliveryAddress: cartAddress['@id']
    }
  }
}

const createOrder = (client, payload, stripeToken) => {
  return client.post('/api/orders', payload)
    .then((order) => {
      return client.put(order['@id'] + '/pay', {
        stripeToken: stripeToken.id
      })
    })
}

export const finalizeOrder = (stripeToken) => (dispatch, getState) => {

  const { client, restaurant, cartItems, cartAddress } = getState();
  const isNewAddress = !cartAddress.hasOwnProperty('@id');

  dispatch({ type: 'CREATE_ORDER_REQUEST' });

  if (isNewAddress) {
    createAddress(client, cartAddress)
      .then(newAddress => createOrder(client, createOrderPayload(restaurant, cartItems, newAddress), stripeToken))
      .then(order => dispatch({ type: 'CREATE_ORDER_SUCCESS', order }))
  } else {
    createOrder(client, createOrderPayload(restaurant, cartItems, cartAddress), stripeToken)
      .then(order => dispatch({ type: 'CREATE_ORDER_SUCCESS', order }))
  }

  // TODO Error control
}

export const closeModal = () => {
  return { type: 'CLOSE_MODAL' }
}

export const checkDistance = () => (dispatch, getState) => {

  const { client, restaurant, cartAddress } = getState();

  dispatch({ type: 'CHECK_DISTANCE_REQUEST' });

  client.get(restaurant['@id'] + '/can-deliver/' + cartAddress.geo.latitude + ',' + cartAddress.geo.longitude)
    .then(response => dispatch({ type: 'CHECK_DISTANCE_SUCCESS' }))
    .catch(e => dispatch({ type: 'CHECK_DISTANCE_FAILURE' }))
}
