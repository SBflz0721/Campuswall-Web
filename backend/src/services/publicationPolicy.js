import { hasCapability } from './roles.js'
import { reviewPostContent } from './contentReview.js'

export const pendingPublication = {
  moderation_status: 'pending',
  review_status: 'pending',
  review_bypass_reason: '',
  review_source: '',
  review_hits: []
}

export const visiblePublication = (reason, extra = {}) => ({
  moderation_status: 'visible',
  review_status: 'approved',
  review_bypass_reason: reason,
  review_source: extra.review_source || reason,
  review_hits: extra.review_hits || []
})

export const immediatePublicationState = ({ user = null, admin = null } = {}) => {
  const privileged = (admin && (!Array.isArray(admin.capabilities) || hasCapability(admin, 'content.publish.bypass_review')))
    || hasCapability(user, 'content.publish.bypass_review')
  // Lost-and-found posts no longer bypass review: only privileged authors with the
  // explicit bypass capability publish immediately. Everything else goes through the
  // lexicon / AI check below, so lost-and-found text can no longer be used to publish
  // banned content straight to the public wall.
  return privileged ? visiblePublication('privileged_author') : null
}

export const publicationStateFor = async ({
  user = null,
  admin = null,
  lostFound = null,
  text = '',
  title = '',
  tags = [],
  requirePostApproval = false
} = {}) => {
  const immediate = immediatePublicationState({ user, admin })
  if (immediate) return immediate
  const review = await reviewPostContent(text, { title, tags })
  if (review.blocked) {
    return {
      ...pendingPublication,
      review_source: review.source || 'lexicon',
      review_hits: review.hits || []
    }
  }
  if (requirePostApproval) {
    return {
      ...pendingPublication,
      review_source: 'manual_required',
      review_hits: []
    }
  }
  return visiblePublication('ai_clean', { review_source: review.source || 'lexicon_clean' })
}

export const editedPublicationStateFor = async ({ message = null, ...context } = {}) => {
  if (message?.review_hold === true) {
    return { ...pendingPublication, review_source: 'review_hold' }
  }
  return publicationStateFor(context)
}
