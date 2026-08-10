#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wnullability-completeness"

#include <string>
#include <vector>
#include <memory>

#ifndef REACT_NATIVE_DEBUG
#define REACT_NATIVE_DEBUG 1
#endif

#ifndef RN_DEBUG_STRING_CONVERTIBLE
#define RN_DEBUG_STRING_CONVERTIBLE 1
#endif

#include <react/renderer/core/Sealable.h>
#include <react/renderer/core/ShadowNode.h>
#include <react/renderer/debug/DebugStringConvertible.h>

namespace facebook::react {

Sealable::Sealable() {}
Sealable::~Sealable() {}
void Sealable::ensureUnsealed() const {}

std::string ShadowNode::getDebugName() const { return ""; }
std::string ShadowNode::getDebugValue() const { return ""; }
SharedDebugStringConvertibleList ShadowNode::getDebugChildren() const { return {}; }

SharedDebugStringConvertibleList DebugStringConvertible::getDebugProps() const { return {}; }

}

#pragma clang diagnostic pop
