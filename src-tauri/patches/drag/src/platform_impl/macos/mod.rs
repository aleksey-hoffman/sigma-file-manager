// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// Copyright 2023-2023 CrabNebula Ltd.
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use std::{
    ffi::{c_char, c_void},
    sync::atomic::{AtomicBool, Ordering},
};

use cocoa::{
    appkit::{NSApp, NSEvent, NSEventModifierFlags, NSEventType, NSImage},
    base::{id, nil},
    foundation::{NSArray, NSData, NSPoint, NSRect, NSSize, NSUInteger},
};
use core_graphics::display::CGDisplay;
use objc::{
    declare::ClassDecl,
    runtime::{Class, Object, Protocol, Sel, BOOL, NO, YES},
};
use raw_window_handle::{HasWindowHandle, RawWindowHandle};

use crate::{CursorPosition, DragItem, DragMode, DragResult, Image, Options};

const UTF8_ENCODING: usize = 4;

struct NSString(id);

impl NSString {
    fn new(s: &str) -> Self {
        // Safety: objc runtime calls are unsafe
        NSString(unsafe {
            let ns_string: id = msg_send![class!(NSString), alloc];
            let ns_string: id = msg_send![ns_string,
                            initWithBytes:s.as_ptr()
                            length:s.len()
                            encoding:UTF8_ENCODING];

            // The thing is allocated in rust, the thing must be set to autorelease in rust to relinquish control
            // or it can not be released correctly in OC runtime
            let _: () = msg_send![ns_string, autorelease];

            ns_string
        })
    }

    fn to_str(&self) -> &str {
        unsafe {
            let bytes: *const c_char = msg_send![self.0, UTF8String];
            let len = msg_send![self.0, lengthOfBytesUsingEncoding: UTF8_ENCODING];
            let bytes = std::slice::from_raw_parts(bytes as *const u8, len);
            std::str::from_utf8_unchecked(bytes)
        }
    }
}

pub fn start_drag<W: HasWindowHandle, F: Fn(DragResult, CursorPosition) + Send + 'static>(
    handle: &W,
    item: DragItem,
    image: Image,
    on_drop_callback: F,
    options: Options,
) -> crate::Result<()> {
    if let Ok(RawWindowHandle::AppKit(w)) = handle.window_handle().map(|h| h.as_raw()) {
        unsafe {
            let window: id = msg_send![w.ns_view.as_ptr() as id, window];
            // wry replaces the ns_view so we don't really use AppKitWindowHandle::ns_view
            let ns_view: id = msg_send![window, contentView];

            let current_position: NSPoint = msg_send![window, mouseLocationOutsideOfEventStream];

            let img: id = msg_send![class!(NSImage), alloc];
            let img: id = match image {
                Image::File(path) => {
                    if !path.exists() {
                        return Err(crate::Error::ImageNotFound);
                    }
                    NSImage::initByReferencingFile_(img, NSString::new(&path.to_string_lossy()).0)
                }
                Image::Raw(bytes) => {
                    let data = NSData::dataWithBytes_length_(
                        nil,
                        bytes.as_ptr() as *const std::os::raw::c_void,
                        bytes.len() as u64,
                    );
                    NSImage::initWithData_(NSImage::alloc(nil), data)
                }
            };
            let image_size: NSSize = img.size();
            let image_rect = NSRect::new(
                NSPoint::new(
                    current_position.x - image_size.width / 2.,
                    current_position.y - image_size.height / 2.,
                ),
                image_size,
            );

            let dragging_items: id = msg_send![class!(NSMutableArray), array];

            match item {
                DragItem::Files(files) => {
                    for path in files {
                        let nsurl: id = msg_send![class!(NSURL), fileURLWithPath: NSString::new(&path.display().to_string()) isDirectory: false];
                        let drag_item: id = msg_send![class!(NSDraggingItem), alloc];
                        let item: id = msg_send![drag_item, initWithPasteboardWriter: nsurl];

                        let _: () = msg_send![item, setDraggingFrame: image_rect contents: img];

                        let _: () = msg_send![dragging_items, addObject: item];
                    }
                }
                DragItem::Data { provider, types } => {
                    let cls = ClassDecl::new("DragRsDataProvider", class!(NSObject));
                    let cls = match cls {
                        Some(mut cls) => {
                            cls.add_ivar::<*mut c_void>("provider_ptr");
                            cls.add_protocol(
                                Protocol::get("NSPasteboardItemDataProvider").unwrap(),
                            );
                            cls.add_method(
                                sel!(pasteboard:item:provideDataForType:),
                                provide_data as extern "C" fn(&Object, Sel, id, id, id),
                            );
                            cls.add_method(
                                sel!(pasteboardFinishedWithDataProvider:),
                                pasteboard_finished as extern "C" fn(&Object, Sel, id),
                            );

                            extern "C" fn pasteboard_finished(
                                this: &Object,
                                _: Sel,
                                _pasteboard: id,
                            ) {
                                unsafe {
                                    let provider = this.get_ivar::<*mut c_void>("provider_ptr");
                                    drop(Box::from_raw(
                                        *provider as *mut Box<dyn Fn(&str) -> Option<Vec<u8>>>,
                                    ));
                                }
                            }

                            extern "C" fn provide_data(
                                this: &Object,
                                _: Sel,
                                _pasteboard: id,
                                item: id,
                                data_type: id,
                            ) {
                                unsafe {
                                    let provider = this.get_ivar::<*mut c_void>("provider_ptr");

                                    let provider =
                                        &*(*provider as *mut Box<dyn Fn(&str) -> Option<Vec<u8>>>);

                                    if let Some(data) = provider(NSString(data_type).to_str()) {
                                        let bytes = data.as_ptr() as *mut c_void;
                                        let length = data.len();
                                        let data: id = msg_send![class!(NSData), alloc];
                                        let data: id = msg_send![data, initWithBytesNoCopy:bytes length:length freeWhenDone: if length == 0 { NO } else { YES }];

                                        let _: () =
                                            msg_send![item, setData: data forType: data_type];
                                    }
                                }
                            }

                            cls.register()
                        }
                        None => Class::get("DragRsDataProvider")
                            .expect("Failed to get the class definition"),
                    };

                    let data_provider: id = msg_send![cls, alloc];
                    let data_provider: id = msg_send![data_provider, init];

                    let provider_ptr = Box::into_raw(Box::new(provider));
                    (*data_provider)
                        .set_ivar("provider_ptr", provider_ptr as *mut _ as *mut c_void);

                    let item: id = msg_send![class!(NSPasteboardItem), alloc];
                    let item: id = msg_send![item, init];
                    let types = types
                        .into_iter()
                        .map(|t| NSString::new(&t).0)
                        .collect::<Vec<id>>();
                    let _: () = msg_send![item, setDataProvider: data_provider forTypes: NSArray::arrayWithObjects(nil, &types)];

                    let drag_item: id = msg_send![class!(NSDraggingItem), alloc];
                    let item: id = msg_send![drag_item, initWithPasteboardWriter: item];

                    let _: () = msg_send![item, setDraggingFrame: image_rect contents: img];

                    let _: () = msg_send![dragging_items, addObject: item];
                }
            }

            let drag_event: id = msg_send![class!(NSEvent), alloc];
            let current_event: id = msg_send![NSApp(), currentEvent];
            let drag_event: id = NSEvent::mouseEventWithType_location_modifierFlags_timestamp_windowNumber_context_eventNumber_clickCount_pressure_(
        drag_event,
        NSEventType::NSLeftMouseDragged,
        current_position,
      NSEventModifierFlags::empty(),
        msg_send![current_event, timestamp],
        msg_send![window, windowNumber],
        nil,
         0,
          1,
          1.0
        );

            let cls = ClassDecl::new("DragRsSource", class!(NSObject));
            let cls = match cls {
                Some(mut cls) => {
                    cls.add_ivar::<*mut c_void>("on_drop_ptr");
                    cls.add_ivar::<BOOL>("animate_on_cancel_or_failure");
                    cls.add_ivar::<DragMode>("drag_mode");
                    cls.add_method(
                        sel!(draggingSession:sourceOperationMaskForDraggingContext:),
                        dragging_session
                            as extern "C" fn(&Object, Sel, id, NSUInteger) -> NSUInteger,
                    );
                    cls.add_method(
                        sel!(draggingSession:endedAtPoint:operation:),
                        dragging_session_end
                            as extern "C" fn(&Object, Sel, id, NSPoint, NSUInteger),
                    );

                    extern "C" fn dragging_session(
                        this: &Object,
                        _: Sel,
                        dragging_session: id,
                        _context: NSUInteger,
                    ) -> NSUInteger {
                        unsafe {
                            let animates = this.get_ivar::<BOOL>("animate_on_cancel_or_failure");
                            let mode = *this.get_ivar::<DragMode>("drag_mode");
                            let () = msg_send![dragging_session, setAnimatesToStartingPositionsOnCancelOrFail: *animates];

                            match mode {
                                DragMode::Copy => 1,  // NSDragOperationCopy
                                DragMode::Move => 16, // NSDragOperationMove
                            }
                        }
                    }

                    extern "C" fn dragging_session_end(
                        this: &Object,
                        _: Sel,
                        _dragging_session: id,
                        ended_at_point: NSPoint,
                        operation: NSUInteger,
                    ) {
                        unsafe {
                            let callback = this.get_ivar::<*mut c_void>("on_drop_ptr");

                            let mouse_location = CursorPosition {
                                x: ended_at_point.x as i32,
                                y: CGDisplay::main().pixels_high() as i32 - ended_at_point.y as i32,
                            };

                            let callback_closure =
                                &*(*callback as *mut Box<dyn Fn(DragResult, CursorPosition)>);

                            if operation == 0 {
                                // NSDragOperationNone
                                callback_closure(DragResult::Cancel, mouse_location);
                            } else {
                                callback_closure(DragResult::Dropped, mouse_location);
                            }

                            drop(Box::from_raw(*callback as *mut Box<dyn Fn(DragResult)>));
                        }
                    }

                    cls.register()
                }
                None => Class::get("DragRsSource").expect("Failed to get the class definition"),
            };

            let source: id = msg_send![cls, alloc];
            let source: id = msg_send![source, init];

            let on_drop_callback =
                Box::new(on_drop_callback) as Box<dyn Fn(DragResult, CursorPosition) + Send>;
            let callback_ptr = Box::into_raw(Box::new(on_drop_callback));
            (*source).set_ivar("on_drop_ptr", callback_ptr as *mut _ as *mut c_void);
            (*source).set_ivar(
                "animate_on_cancel_or_failure",
                if options.skip_animatation_on_cancel_or_failure {
                    YES
                } else {
                    NO
                },
            );
            (*source).set_ivar("drag_mode", options.mode);

            let _: () = msg_send![ns_view, beginDraggingSessionWithItems: dragging_items event: drag_event source: source];

            Ok(())
        }
    } else {
        Err(crate::Error::UnsupportedWindowHandle)
    }
}
