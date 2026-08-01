export function resolveFollowLatest({ following, distanceFromBottom, movedTowardHistory }) {
  if (movedTowardHistory) return false;
  return following ? distanceFromBottom < 180 : distanceFromBottom < 32;
}

export function movedTowardHistory(previousScrollTop, currentScrollTop) {
  return Number.isFinite(previousScrollTop)
    && currentScrollTop < previousScrollTop - 1;
}
